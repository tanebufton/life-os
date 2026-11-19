"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { rescheduleOverdueAction } from "@/lib/actions5";

/** One click to deal with a pile of overdue tasks: move them all to today, tomorrow or next week. */
export function OverdueActions({ count }: { count: number }) {
  const router = useRouter(), [busy, go] = useTransition();
  const move = (to: "today" | "tomorrow" | "nextweek") => go(async () => { const r = await rescheduleOverdueAction(to); toast(r.ok ? (r.message ?? "Done") : r.error); router.refresh(); });
  const b = "rounded px-1.5 py-0.5 text-[11px] font-medium text-mute hover:bg-raise hover:text-fg disabled:opacity-50";
  return (
    <span className="ml-auto flex items-center gap-0.5" aria-label={`Reschedule all ${count} overdue tasks`}>
      <span className="mr-1 text-[11px] font-normal text-dim">Move all to</span>
      <button className={b} disabled={busy} onClick={() => move("today")}>Today</button><button className={b} disabled={busy} onClick={() => move("tomorrow")}>Tomorrow</button><button className={b} disabled={busy} onClick={() => move("nextweek")}>Next week</button>
    </span>
  );
}
