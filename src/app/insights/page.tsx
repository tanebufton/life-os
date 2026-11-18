import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { Heatmap } from "@/components/heatmap";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { nice } from "@/lib/dates";
import { isOn } from "@/lib/features";
import { insights } from "@/lib/insights";

export const dynamic = "force-dynamic";
const Delta = ({ now, prev }: { now: number; prev: number }) => { const d = now - prev; return <span className={`ml-2 text-xs font-medium ${d > 0 ? "text-ok" : d < 0 ? "text-danger" : "text-dim"}`}>{d > 0 ? "▲" : d < 0 ? "▼" : "–"} {Math.abs(d)} vs last week</span>; };

export default function Insights() {
  const i = insights();
  const maxP = Math.max(1, ...i.byProject.map((p) => p.count));
  const Stat = ({ v, l, sub }: { v: React.ReactNode; l: string; sub?: React.ReactNode }) => <div className="px-4 py-4"><div className="text-[28px] font-semibold leading-none tracking-tight">{v}</div><div className="mt-2 text-xs text-mute">{l}</div>{sub && <div className="mt-0.5">{sub}</div>}</div>;
  return (
    <FeatureGate feature="insights">
      <PageHead title="Insights" sub="How you're really doing, measured quietly" right={isOn("review") ? <Link href="/review?mode=week" className="btn"><Icon name="review" size={15} className="text-accent" />Weekly review</Link> : undefined} />
      <div className="mx-auto max-w-4xl space-y-4">
        <Panel i={0} bodyClass="grid grid-cols-2 divide-x sm:grid-cols-4">
          <Stat v={i.thisWeek} l="Completed, last 7 days" sub={<Delta now={i.thisWeek} prev={i.lastWeek} />} />
          <Stat v={<span className="inline-flex items-center gap-1.5"><Icon name="flame" size={22} className={i.streak ? "text-warn" : "text-dim"} />{i.streak}</span>} l="Day streak" sub={<span className="text-xs text-dim">best {i.bestStreak}</span>} />
          {isOn("focus") ? <Stat v={<>{i.focusWeek}<span className="text-base font-medium text-mute"> min</span></>} l="Focused, last 7 days" sub={<Delta now={i.focusWeek} prev={i.focusPrev} />} /> : <Stat v={i.total} l="Completed, last 6 months" />}
          <Stat v={i.bestDay.count || "–"} l="Best single day" sub={i.bestDay.date ? <span className="text-xs text-dim">{nice(i.bestDay.date)}</span> : undefined} />
        </Panel>
        <Panel title="Completed tasks, last 26 weeks" right={<span>{i.total} total</span>} i={1}><div className="px-4 pb-4"><Heatmap cells={i.heat} color="var(--accent)" label={(c) => `${nice(c.date)}: ${c.count} completed`} /></div></Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Where the effort went (30 days)" i={2}>
            <div className="space-y-2.5 px-4 pb-4">{i.byProject.length ? i.byProject.map((p) => (
              <div key={p.name}><div className="mb-1 flex justify-between text-[13px]"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-[3px]" style={{ background: p.color }} />{p.name}</span><span className="text-mute">{p.count}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full" style={{ width: `${(p.count / maxP) * 100}%`, background: p.color }} /></div></div>)) : <p className="text-sm text-mute">Complete a few tasks to see the split.</p>}</div>
          </Panel>
          {isOn("habits") && (
            <Panel title="Habit consistency (30 days)" i={3} right={<Link href="/habits" className="font-medium text-accent hover:underline">Habits</Link>}>
              <div className="space-y-2.5 px-4 pb-4">{i.habits.length ? i.habits.map((h) => (
                <div key={h.name}><div className="mb-1 flex justify-between text-[13px]"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: h.color }} />{h.name}</span><span className="text-mute">{h.rate30}% · <Icon name="flame" size={11} className="inline text-warn" /> {h.streak}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full" style={{ width: `${h.rate30}%`, background: h.color }} /></div></div>)) : <p className="text-sm text-mute">No habits yet.</p>}</div>
            </Panel>
          )}
        </div>
      </div>
    </FeatureGate>
  );
}
