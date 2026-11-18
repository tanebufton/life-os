import { Pomodoro, Timers } from "@/components/focus";
import { card } from "@/components/ui";
import { focusStats } from "@/lib/focus";
import { queryTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export default function Focus() {
  const tasks = queryTasks().map((t) => ({ id: t.id, title: t.title }));
  const stats = focusStats(7);
  const max = Math.max(60, ...stats.map((s) => s.minutes));
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Focus</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Pomodoro tasks={tasks} />
        <div className="space-y-4">
          <Timers />
          <div className={card}>
            <h2 className="mb-3 font-semibold">Last 7 days</h2>
            {stats.length === 0 ? <p className="text-sm text-neutral-500">Finish a focus session and it shows up here.</p> : (
              <ul className="space-y-1.5 text-sm">
                {stats.map((s) => (
                  <li key={s.date} className="flex items-center gap-2"><span className="w-20 text-neutral-500">{s.date.slice(5)}</span>
                    <span className="h-3 rounded bg-indigo-500" style={{ width: `${(s.minutes / max) * 70}%`, minWidth: 4 }} /><span>{s.minutes}m</span></li>))}
              </ul>)}
          </div>
        </div>
      </div>
    </>
  );
}
