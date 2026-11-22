"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Shown on a task opened from a reminder (`?reminder=…`): a tap on a push on iPhone (no buttons there), or Mark done / Snooze when the
 * notification couldn't reach LifeOS by itself because the sign-in had ended. The buttons wait for a tap rather than acting on the link,
 * so a link from anywhere else can never complete a task on its own.
 */
export function ReminderBanner({ id, done, snooze }: { id: number; done: boolean; snooze: number }) {
  const sp = useSearchParams(), path = usePathname(), router = useRouter(), want = sp.get("reminder"), [busy, setBusy] = useState(false);
  if (!want) return null;
  const close = () => router.replace(path, { scroll: false });
  const act = async (action: "done" | "snooze") => {
    setBusy(true);
    try {
      const r = await fetch("/api/reminders", { method: "POST", headers: { "content-type": "application/json", "x-lifeos": "1" }, body: JSON.stringify({ id, action, minutes: snooze }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean };
      if (!r.ok || !j.ok) throw new Error();
      toast(action === "done" ? "Marked done" : `Snoozed for ${snooze} min`); close(); router.refresh();
    } catch { toast("That didn't go through. Check your connection and try again."); } finally { setBusy(false); }
  };
  return (
    <div role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-[13px]">
      <span className="mr-auto">{done ? "This task is already done." : want === "done" ? "Your reminder couldn't mark this done while you were signed out. Finish it here:" : want === "snooze" ? "Your reminder couldn't snooze this while you were signed out:" : "From your reminder:"}</span>
      {!done && <><button className={want === "snooze" ? "btn" : "btn-primary"} disabled={busy} onClick={() => act("done")}>Mark done</button><button className={want === "snooze" ? "btn-primary" : "btn"} disabled={busy} onClick={() => act("snooze")}>Snooze {snooze} min</button></>}
      <button className="btn" disabled={busy} onClick={close} aria-label="Dismiss">Dismiss</button>
    </div>
  );
}
