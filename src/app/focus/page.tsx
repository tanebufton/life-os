import { FeatureGate } from "@/components/FeatureGate";
import { Pomodoro, Timers } from "@/components/focus";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { addDays } from "@/lib/dates";
import { focusStats } from "@/lib/focus";
import { queryTasks } from "@/lib/tasks";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export default async function Focus({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const taskParam = Number((await searchParams).task) || null;
  const tasks = queryTasks().map((t) => ({ id: t.id, title: t.title }));
  const t = today();
  const by = new Map(focusStats(7).map((s) => [s.date, s]));
  const days = Array.from({ length: 7 }, (_, k) => { const date = addDays(t, k - 6); return { date, minutes: by.get(date)?.minutes ?? 0, sessions: by.get(date)?.sessions ?? 0 }; });
  const max = Math.max(60, ...days.map((d) => d.minutes));
  const total = days.reduce((a, d) => a + d.minutes, 0);
  const label = (d: string) => new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", weekday: "short" }).format(new Date(d + "T00:00:00Z"));
  return (
    <FeatureGate feature="focus">
      <PageHead title="Focus" sub="Pomodoro, timers and your focus history" />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Pomodoro tasks={tasks} presetTask={taskParam} />
        <div className="space-y-4">
          <Timers />
          <Panel title="Last 7 days" i={2} right={<span><b className="text-fg">{total}</b> min total</span>}>
            <div className="relative mx-4 mb-4 mt-2 h-40">
              {[0, 1, 2].map((g) => <div key={g} className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${22 + g * 34}%` }} />)}
              <div className="absolute inset-0 flex items-end gap-2.5 pb-5">
                {days.map((d) => (
                  <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.minutes} min, ${d.sessions} sessions`}>
                    <span className="mb-1 text-[11px] text-mute">{d.minutes || ""}</span>
                    <div className={`w-full max-w-9 rounded-t-md ${d.date === t ? "bg-accent" : "bg-accent/25"}`} style={{ height: `${Math.max((d.minutes / max) * 82, d.minutes ? 4 : 0)}%` }} />
                  </div>))}
              </div>
              <div className="absolute inset-x-0 bottom-0 flex gap-2.5">{days.map((d) => <span key={d.date} className={`flex-1 text-center text-[11px] ${d.date === t ? "font-semibold text-fg" : "text-dim"}`}>{label(d.date)}</span>)}</div>
            </div>
          </Panel>
        </div>
      </div>
    </FeatureGate>
  );
}
