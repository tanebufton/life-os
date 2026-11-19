import Link from "next/link";
import { eventsOn } from "@/lib/calendar";
import { isOn } from "@/lib/features";
import { goalProgress, listGoals } from "@/lib/goals";
import { today } from "@/lib/time";
import { Panel } from "./Panel";

export function EventsPanel({ i = 0 }: { i?: number }) {
  const t = today(), ev = eventsOn(t).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return (
    <Panel title="Calendar" i={i} right={isOn("planner") ? <Link href="/planner" className="font-medium text-accent hover:underline">Planner</Link> : undefined}>
      <ul className="pb-1.5">{ev.slice(0, 6).map((e) => <li key={e.id} className="flex items-center gap-3 px-4 py-1.5 text-[13px]"><span className="w-12 shrink-0 tabular-nums text-mute">{e.all_day ? "All day" : e.start_time}</span><span className="min-w-0 flex-1 truncate">{e.title}</span></li>)}
        {!ev.length && <li className="px-4 py-2 text-sm text-mute">No events today.</li>}</ul>
    </Panel>
  );
}
export function GoalsPanel({ i = 0 }: { i?: number }) {
  const gs = listGoals().slice(0, 4);
  if (!gs.length) return null;
  return (
    <Panel title="Goals" i={i} right={<Link href="/goals" className="font-medium text-accent hover:underline">All</Link>}>
      <ul className="space-y-2 px-4 pb-3">{gs.map((g) => { const p = goalProgress(g).pct; return <li key={g.id}><div className="mb-1 flex justify-between text-[13px]"><span className="truncate">{g.title}</span><span className="tabular-nums text-mute">{p}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full bg-accent" style={{ width: `${p}%` }} /></div></li>; })}</ul>
    </Panel>
  );
}
