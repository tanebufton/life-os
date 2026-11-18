"use client";
import { useState, useTransition } from "react";
import { toggleHabitAction } from "@/lib/actions";
import { addDays } from "@/lib/dates";
import { Icon } from "./Icon";

export function HabitCheck({ id, done, scheduled, color }: { id: number; done: boolean; scheduled: boolean; color: string }) {
  const [on, setOn] = useState(done);
  const [, start] = useTransition();
  return (
    <button onClick={() => { setOn(!on); start(async () => { await toggleHabitAction(id); }); }} aria-label={on ? "Mark not done" : "Mark done"} aria-pressed={on}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all ${on ? "scale-105 text-white" : scheduled ? "hover:bg-fg/5" : "opacity-50"}`}
      style={{ borderColor: color, background: on ? color : undefined }}><Icon name="check" size={15} className={on ? "" : "opacity-0"} /></button>
  );
}
/** Last 7 days as tappable dots, so you can backfill yesterday. */
export function WeekDots({ id, today, done, days, color }: { id: number; today: string; done: string[]; days: number[]; color: string }) {
  const [set, setSet] = useState(new Set(done));
  const [, start] = useTransition();
  const label = (d: string) => new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", weekday: "narrow" }).format(new Date(d + "T00:00:00Z"));
  const dow = (d: string) => new Date(d + "T00:00:00Z").getUTCDay();
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => {
        const on = set.has(d), sched = days.includes(dow(d));
        return (
          <button key={d} title={d} onClick={() => { const n = new Set(set); on ? n.delete(d) : n.add(d); setSet(n); start(async () => { await toggleHabitAction(id, d); }); }} aria-label={`${d} ${on ? "done" : "not done"}`}
            className="flex flex-col items-center gap-1 text-[10px] text-dim"><span className={`grid h-6 w-6 place-items-center rounded-full border ${on ? "text-white" : sched ? "" : "opacity-40"}`} style={{ borderColor: on ? color : undefined, background: on ? color : undefined }}>{on && <Icon name="check" size={13} />}</span>{label(d)}</button>
        );
      })}
    </div>
  );
}
