import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { addGoalAction, addKrAction, deleteGoalAction, deleteKrAction, goalStatusAction, setKrAction } from "@/lib/actions3";
import { diffDays, nice } from "@/lib/dates";
import { AREAS, areaBalance, goalProgress, listGoals } from "@/lib/goals";
import { today } from "@/lib/time";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const Bar = ({ pct }: { pct: number }) => <div className="h-1.5 overflow-hidden rounded-full bg-raise" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>;
export default function Goals() {
  const t = today(), goals = listGoals(), done = listGoals("done"), bal = areaBalance().filter((a) => a.goals > 0), projects = db.prepare("SELECT id, name FROM projects WHERE archived=0").all() as { id: number; name: string }[];
  void projects;
  return (
    <FeatureGate feature="goals">
      <div className="max-w-4xl">
        <PageHead title="Goals" sub="What you're working towards, by area of life" />
        {bal.length > 1 && <Panel i={0} className="mb-4" bodyClass="grid grid-cols-2 gap-x-6 gap-y-3 p-4 sm:grid-cols-4">{bal.map((a) => <div key={a.area}><div className="mb-1 flex justify-between text-xs"><span className="text-mute">{a.area}</span><span className="tabular-nums">{a.avg}%</span></div><Bar pct={a.avg} /></div>)}</Panel>}
        <div className="space-y-4">
          {goals.map((g, i) => { const p = goalProgress(g), left = g.target_date ? diffDays(g.target_date, t) : null; return (
            <Panel key={g.id} i={i + 1} bodyClass="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-[16px] font-semibold">{g.title}</h2><span className="lozenge bg-raise text-mute">{g.area}</span></div>
                <p className="text-xs text-mute">{g.target_date ? `By ${nice(g.target_date)}${left !== null ? (left < 0 ? ` · ${-left} days overdue` : ` · ${left} days left`) : ""}` : "No target date"}{p.tasksTotal ? ` · ${p.tasksDone}/${p.tasksTotal} project tasks` : ""}</p></div>
                <div className="text-right text-2xl font-semibold tabular-nums">{p.pct}%</div></div>
              <div className="my-3"><Bar pct={p.pct} /></div>
              <ul className="space-y-2">{p.krs.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center gap-2 text-[13px]"><span className="min-w-0 flex-1 basis-40">{k.title}</span>
                  <form action={async (fd: FormData) => { "use server"; await setKrAction(k.id, Number(fd.get("v"))); }} className="flex items-center gap-1.5"><input name="v" defaultValue={k.current} inputMode="decimal" aria-label={`Progress for ${k.title}`} className="field !w-20 !py-1 text-right" /><span className="text-mute">/ {k.target} {k.unit}</span><button className="btn !px-2 !py-1 text-xs">Update</button></form>
                  <form action={deleteKrAction.bind(null, k.id)}><button className="text-xs text-dim hover:text-danger" aria-label="Remove key result">Remove</button></form></li>))}</ul>
              <form action={addKrAction.bind(null, g.id)} className="mt-3 flex flex-wrap gap-2"><input name="title" required placeholder="Add a key result, e.g. Run 100 km" className="field !w-auto min-w-48 flex-1" /><input name="target" required inputMode="decimal" placeholder="Target" className="field !w-24" /><input name="unit" placeholder="Unit" className="field !w-24" /><button className="btn">Add</button></form>
              <div className="mt-3 flex gap-3 text-xs"><form action={goalStatusAction.bind(null, g.id, "done")}><button className="text-mute hover:text-fg">Mark achieved</button></form><form action={goalStatusAction.bind(null, g.id, "archived")}><button className="text-mute hover:text-fg">Archive</button></form><form action={deleteGoalAction.bind(null, g.id)}><button className="text-mute hover:text-danger">Delete</button></form></div>
            </Panel>); })}
          {!goals.length && <Panel i={1} bodyClass="px-4 py-10 text-center text-sm text-mute">No goals yet. Start with one thing you want to be true by the end of the year.</Panel>}
          <Panel title="New goal" i={9}><form action={addGoalAction} className="flex flex-wrap gap-2 px-4 pb-4"><input name="title" required placeholder="e.g. Run a half marathon" className="field !w-auto min-w-56 flex-1" /><select name="area" className="field !w-40" aria-label="Area">{AREAS.map((a) => <option key={a}>{a}</option>)}</select><input type="date" name="target_date" aria-label="Target date" className="field !w-40" /><button className="btn-primary">Add goal</button></form></Panel>
          {done.length > 0 && <Panel title="Achieved" count={done.length} i={10}><ul>{done.map((g) => <li key={g.id} className="flex justify-between border-b px-4 py-2 text-[13px] last:border-b-0"><span>{g.title}</span><form action={goalStatusAction.bind(null, g.id, "active")}><button className="text-mute hover:text-fg">Reopen</button></form></li>)}</ul></Panel>}
        </div>
        <Link href="/tasks" className="sr-only">tasks</Link>
      </div>
    </FeatureGate>
  );
}
