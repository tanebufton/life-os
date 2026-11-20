"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logFocus } from "@/lib/actions";
import { LABEL, MINUTES, beep, load, mmss, notify, save, type Mode, type P, type T } from "./focus";
import { Icon } from "./Icon";

/**
 * Keeps the Pomodoro and timers alive while you move around LifeOS. The Focus page owns them when it's open; everywhere else this
 * shows what's running in the top bar and, when one finishes, beeps, notifies, logs the session and moves on, exactly as the page would.
 */
export function FocusChip() {
  const path = usePathname(), onFocus = path.startsWith("/focus"), [chip, setChip] = useState<{ text: string; label: string; hot: boolean } | null>(null), busy = useRef(false);
  useEffect(() => {
    let showing = false; const pageTitle = () => document.documentElement.dataset.pageTitle || "LifeOS"; // the page's own title, put back when no timer is running
    const tick = () => {
      const now = Date.now(); let best: { left: number; label: string; hot: boolean } | null = null;
      const p = load<P | null>("lifeos.pomo", null);
      if (p?.endsAt) {
        const left = Math.ceil((p.endsAt - now) / 1000);
        if (left <= 0) {
          if (!onFocus && !busy.current) {
            busy.current = true;
            const mins = load("lifeos.pomo.mins", MINUTES), cycles = p.mode === "focus" ? p.cycles + 1 : p.cycles, next: Mode = p.mode === "focus" ? (cycles % 4 === 0 ? "long" : "short") : "focus";
            beep(); notify(p.mode === "focus" ? "Focus session done 🎉" : "Break over", p.mode === "focus" ? "Time for a break." : "Back to it.");
            if (p.mode === "focus") void logFocus(p.total, "focus", p.taskId, "");
            save("lifeos.pomo", { ...p, mode: next, total: mins[next] * 60, left: mins[next] * 60, endsAt: null, cycles });
            busy.current = false;
          }
        } else best = { left, label: LABEL[p.mode], hot: p.mode === "focus" };
      }
      const ts = load<T[]>("lifeos.timers", []);
      if (!onFocus && ts.some((t) => !t.done && t.endsAt <= now)) { beep(); for (const t of ts) if (!t.done && t.endsAt <= now) notify("Timer done", t.label || mmss(t.total)); save("lifeos.timers", ts.map((t) => (!t.done && t.endsAt <= now ? { ...t, done: true } : t))); }
      for (const t of ts) if (!t.done && t.endsAt > now) { const left = Math.ceil((t.endsAt - now) / 1000); if (!best || left < best.left) best = { left, label: t.label || "Timer", hot: false }; }
      setChip(best ? { text: mmss(best.left), label: best.label, hot: best.hot } : null);
      if (best && !onFocus) { showing = true; document.title = `${mmss(best.left)} · ${best.label}`; } else if (showing) { showing = false; document.title = pageTitle(); }
    };
    tick(); const i = setInterval(tick, 500);
    return () => { clearInterval(i); if (showing) document.title = pageTitle(); };
  }, [onFocus]);
  if (!chip || onFocus) return null;
  return <Link href="/focus" title="Open Focus" className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium tabular-nums transition hover:bg-raise ${chip.hot ? "border-accent/40 text-accent" : "text-fg"}`}><Icon name="focus" size={14} className={chip.hot ? "animate-pulse" : ""} />{chip.text}<span className="hidden text-xs font-normal text-mute lg:inline">{chip.label}</span></Link>;
}
