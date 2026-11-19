import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { AutoSchedule } from "@/components/clientbits";
import { scheduleTaskAction, unscheduleTaskAction } from "@/lib/actions3";
import { addDays, nice } from "@/lib/dates";
import { isOn } from "@/lib/features";
import { dayBlocks, toHm, unscheduled, workHours } from "@/lib/planner";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
const PX = 56; // pixels per hour
export default async function Planner({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const t = today(), sp = await searchParams, date = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : t;
  const { blocks, allDay } = dayBlocks(date), w = workHours(), un = unscheduled(date, t);
  const lo = Math.floor(Math.min(w.start, ...blocks.map((b) => b.start)) / 60) * 60, hi = Math.ceil(Math.max(w.end, ...blocks.map((b) => b.end)) / 60) * 60, hours = Array.from({ length: (hi - lo) / 60 + 1 }, (_, i) => lo + i * 60);
  const nowMin = date === t ? new Date().getHours() * 60 + new Date().getMinutes() : null;
  return (
    <FeatureGate feature="planner">
      <PageHead title="Planner" sub={nice(date)} right={<><Link href={`/planner?d=${addDays(date, -1)}`} className="btn" aria-label="Previous day">‹</Link><Link href="/planner" className="btn">Today</Link><Link href={`/planner?d=${addDays(date, 1)}`} className="btn" aria-label="Next day">›</Link><AutoSchedule date={date} /></>} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel i={0} bodyClass="p-3 sm:p-4">
          {allDay.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{allDay.map((a, i) => <span key={i} className="lozenge" style={{ background: (a.color ?? "#8b5cf6") + "22", color: a.color ?? "#8b5cf6" }}>{a.title}</span>)}</div>}
          <div className="relative" style={{ height: ((hi - lo) / 60) * PX }}>
            {hours.slice(0, -1).map((h) => <div key={h} className="absolute inset-x-0 border-t border-dashed" style={{ top: ((h - lo) / 60) * PX }}><span className="-mt-2 inline-block w-11 bg-panel pr-1 text-right text-[11px] tabular-nums text-dim">{toHm(h)}</span></div>)}
            {nowMin !== null && nowMin >= lo && nowMin <= hi && <div className="absolute inset-x-0 z-10 flex items-center" style={{ top: ((nowMin - lo) / 60) * PX }}><span className="h-2 w-2 -translate-x-1 rounded-full bg-danger" /><span className="h-px flex-1 bg-danger" /></div>}
            <div className="absolute inset-y-0 left-14 right-0">
              {blocks.map((b) => { const h = Math.max(22, ((b.end - b.start) / 60) * PX - 2), ev = b.kind === "event", c = b.color ?? "#6366f1";
                return (
                  <div key={b.key} className={`absolute inset-x-0 overflow-hidden rounded-md border px-2 py-1 text-[12.5px] leading-tight ${b.conflict ? "ring-1 ring-danger" : ""} ${b.done ? "opacity-50" : ""}`} style={{ top: ((b.start - lo) / 60) * PX + 1, height: h, background: c + (ev ? "1f" : "2e"), borderColor: c + "66", borderLeft: `3px solid ${c}` }}>
                    <div className="flex items-start justify-between gap-1"><span className={`min-w-0 truncate font-medium ${b.done ? "line-through" : ""}`}>{b.id ? <Link href={`/tasks/${b.id}`} className="hover:underline">{b.title}</Link> : b.title}</span>
                      {!ev && b.id && <form action={unscheduleTaskAction.bind(null, b.id)}><button className="text-dim hover:text-fg" title="Unschedule" aria-label="Unschedule"><Icon name="x" size={12} /></button></form>}</div>
                    {h > 34 && <div className="text-[11px] text-mute">{toHm(b.start)}–{toHm(b.end)}{b.conflict ? " · overlaps" : ""}</div>}
                  </div>); })}
            </div>
          </div>
          {!blocks.length && <p className="pt-2 text-center text-sm text-mute">Nothing scheduled. Auto-schedule fits your tasks into the free time, or add a time to a task.</p>}
        </Panel>
        <div className="space-y-4">
          <Panel title="To schedule" count={un.length} i={1}>
            <ul>{un.map((x) => <li key={x.id} className="flex items-center gap-2 border-b px-4 py-2 last:border-b-0"><div className="min-w-0 flex-1"><Link href={`/tasks/${x.id}`} className="block truncate text-[13.5px] hover:underline">{x.title}</Link><span className="text-xs text-mute">{x.estimate ?? 30} min{x.priority > 0 ? " · high" : ""}</span></div>
              <form action={scheduleTaskAction.bind(null, x.id, date, undefined)}><button className="btn !px-2 !py-1 text-xs">Fit in</button></form></li>)}
              {!un.length && <li className="px-4 py-6 text-center text-sm text-mute">Everything due has a time.</li>}</ul>
          </Panel>
          <p className="px-1 text-xs text-dim">Working hours {toHm(w.start)}–{toHm(w.end)} <Link href="/settings#planner" className="underline">change</Link>{isOn("calendar") ? "" : " · Calendar sync is off"}</p>
        </div>
      </div>
    </FeatureGate>
  );
}
