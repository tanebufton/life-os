"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { rescheduleAction } from "@/lib/actions";
import { fmtMinutes, fmtTime } from "@/lib/dates";

type T = { id: number; title: string; time: string | null; priority: number; minutes: number | null };
type Day = { date: string; label: string; num: number; isToday: boolean; tasks: T[]; events: { title: string; time: string | null; color: string }[] };
/** Seven days side by side. Drag a task to another day to reschedule it (its time is kept). */
export function WeekGrid({ days, capacity = 360 }: { days: Day[]; capacity?: number }) {
  const router = useRouter(), [, start] = useTransition(), [over, setOver] = useState<string | null>(null);
  const [view, move] = useOptimistic(days, (ds, a: { id: number; to: string }) => { const t = ds.flatMap((d) => d.tasks).find((x) => x.id === a.id); return t ? ds.map((d) => ({ ...d, tasks: d.date === a.to ? [...d.tasks.filter((x) => x.id !== a.id), t] : d.tasks.filter((x) => x.id !== a.id) })) : ds; });
  const drop = (id: number, to: string) => start(async () => { move({ id, to }); try { await rescheduleAction(id, to); router.refresh(); } catch (e) { toast((e as Error).message); } });
  return (
    <div className="grid grid-cols-1 gap-2 pb-2 md:grid-flow-col md:auto-cols-fr md:grid-cols-none xl:gap-3">
      {view.map((d) => (
        <section key={d.date} aria-label={`${d.label} ${d.num}`} onDragOver={(e) => { e.preventDefault(); setOver(d.date); }} onDragLeave={() => setOver((o) => (o === d.date ? null : o))} onDrop={(e) => { e.preventDefault(); setOver(null); const id = Number(e.dataTransfer.getData("text/plain")); if (id) drop(id, d.date); }}
          className={`min-w-0 rounded-xl md:min-h-[50vh] border p-2 transition ${d.isToday ? "border-accent/40 bg-accent/5" : "bg-panel"} ${over === d.date ? "ring-2 ring-accent/50" : ""}`}>
          <h2 className="mb-2 flex items-baseline gap-1.5 px-1"><span className="text-[11px] font-medium text-mute">{d.label}</span><span className={`text-lg font-semibold ${d.isToday ? "text-accent" : ""}`}>{d.num}</span><span className="ml-auto text-[11px] text-dim">{d.tasks.length ? `${d.tasks.length}${d.tasks.reduce((n, t) => n + (t.minutes ?? 0), 0) ? ` · ${fmtMinutes(d.tasks.reduce((n, t) => n + (t.minutes ?? 0), 0))}` : ""}` : ""}</span></h2>
          <Load minutes={d.tasks.reduce((n, t) => n + (t.minutes ?? 0), 0)} capacity={capacity} />
          <ul className="space-y-1.5">
            {d.events.map((e, i) => <li key={`e${i}`} className="rounded-md border-l-[3px] px-2 py-1 text-[12px]" style={{ background: e.color + "1f", borderColor: e.color }}><span className="text-mute">{e.time ?? "All day"}</span> {e.title}</li>)}
            {d.tasks.map((t) => (
              <li key={t.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(t.id)); e.dataTransfer.setData("application/x-lifeos-task", String(t.id)); }} className="cursor-grab rounded-lg border bg-panel p-2 text-[13px] shadow-sm hover:bg-raise/40 active:cursor-grabbing">
                <Link href={`/tasks/${t.id}`} draggable={false} className="block leading-snug hover:underline">{t.title}</Link>
                {(t.time || t.priority > 0) && <div className="mt-1 flex items-center gap-2 text-[11px] text-mute">{t.time && <span>{fmtTime(t.time)}</span>}{t.priority > 0 && <span className="font-medium text-danger">High</span>}</div>}
              </li>))}
            {!d.tasks.length && !d.events.length && <li className="px-1 py-6 text-center text-[11px] text-dim">Nothing</li>}
          </ul>
        </section>))}
    </div>
  );
}

/** How full a day is: the estimates of its tasks against your daily capacity. Green is fine, amber is full, red is over. */
export function Load({ minutes, capacity }: { minutes: number; capacity: number }) {
  if (!minutes) return null;
  const ratio = capacity ? minutes / capacity : 0, tone = ratio > 1.1 ? "bg-danger" : ratio > 0.85 ? "bg-warn" : "bg-ok", text = ratio > 1.1 ? "text-danger" : ratio > 0.85 ? "text-warn" : "text-mute";
  return (
    <div className="mx-1 mb-2" title={`${fmtMinutes(minutes)} planned of ${fmtMinutes(capacity)}`}>
      <div className="h-1 overflow-hidden rounded-full bg-raise"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
      <div className={`mt-0.5 text-[10.5px] tabular-nums ${text}`}>{fmtMinutes(minutes)}{ratio > 1.1 ? ` · over by ${fmtMinutes(minutes - capacity)}` : ""}</div>
    </div>
  );
}
