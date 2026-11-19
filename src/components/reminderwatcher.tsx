"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Due = { id: number; title: string; due: string; time: string; project: string | null; token: string };
const SEEN = "lifeos:rem:seen";
const seen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN) || "[]"); } catch { return []; } };
const remember = (t: string) => { try { localStorage.setItem(SEEN, JSON.stringify([...seen(), t].slice(-200))); } catch { /* ignore */ } };
const post = (id: number, action: "done" | "snooze", minutes?: number) => fetch("/api/reminders", { method: "POST", headers: { "content-type": "application/json", "x-lifeos": "1" }, body: JSON.stringify({ id, action, minutes }) });

/** While LifeOS is open, checks every half minute for timed tasks that are due and shows a notification with Mark done and Snooze buttons. */
export function ReminderWatcher({ enabled }: { enabled: boolean }) {
  const router = useRouter(), busy = useRef(false);
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "lifeos:refresh") router.refresh(); };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    const check = async () => {
      if (busy.current) return; busy.current = true;
      try {
        const j = (await (await fetch("/api/reminders", { cache: "no-store" })).json()) as { on: boolean; snooze: number; due: Due[] };
        if (!j.on) return;
        const granted = "Notification" in window && Notification.permission === "granted", reg = granted ? await Promise.race([navigator.serviceWorker?.ready, new Promise<undefined>((r) => setTimeout(() => r(undefined), 4000))]) : undefined, already = new Set(seen());
        for (const d of j.due) {
          if (already.has(d.token)) continue; remember(d.token);
          const body = [d.time, d.project].filter(Boolean).join(" · ");
          const fallback = () => toast(d.title, { description: body, duration: 60_000, action: { label: "Mark done", onClick: () => void post(d.id, "done").then(() => router.refresh()) }, cancel: { label: `Snooze ${j.snooze} min`, onClick: () => void post(d.id, "snooze", j.snooze) } });
          // One failing notification (blocked, or the worker went away) must not stop the others: fall back to an in-page prompt with the same buttons.
          try { if (!reg) throw new Error("no service worker"); await reg.showNotification(d.title, { body, tag: `task-${d.id}`, requireInteraction: true, data: { id: d.id, snooze: j.snooze, url: `/tasks/${d.id}` }, actions: [{ action: "done", title: "Mark done" }, { action: "snooze", title: `Snooze ${j.snooze} min` }] } as NotificationOptions); } catch { fallback(); }
        }
      } catch { /* offline: try again next time */ } finally { busy.current = false; }
    };
    void check(); const t = setInterval(check, 30_000), f = () => void check();
    window.addEventListener("focus", f);
    return () => { clearInterval(t); window.removeEventListener("focus", f); navigator.serviceWorker?.removeEventListener("message", onMsg); };
  }, [enabled, router]);
  return null;
}
