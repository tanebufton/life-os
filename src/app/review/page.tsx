import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { Panel } from "@/components/Panel";
import { PageHead, TaskGroups } from "@/components/tasks";
import { TriageList } from "@/components/triage";
import { fmtMinutes, nice } from "@/lib/dates";
import { isOn } from "@/lib/features";
import { getSetting } from "@/lib/settings";
import { queryTasks, type TaskRow } from "@/lib/tasks";
import { weeklyReview } from "@/lib/review";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
const item = (t: TaskRow) => ({ id: t.id, title: t.title, due: t.due, time: t.due_time, estimate: t.estimate, project: t.project_name, color: t.project_color, priority: t.priority });

export default async function Review({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const week = (await searchParams).mode === "week";
  const t = today(), open = queryTasks();
  const tab = (on: boolean) => `rounded-md px-3 py-1 text-[13px] font-medium ${on ? "bg-panel shadow-sm" : "text-mute hover:text-fg"}`;
  const head = <PageHead title={week ? "Weekly review" : "Plan your day"} sub={week ? "Look back, clear the decks, look ahead" : "Decide what today is really for"} right={<div className="inline-flex rounded-lg bg-raise p-0.5"><Link href="/review" className={tab(!week)}>Plan day</Link><Link href="/review?mode=week" className={tab(week)}>Weekly review</Link></div>} />;

  if (!week) {
    const overdue = open.filter((x) => x.due && x.due < t), today_ = open.filter((x) => x.due === t), unsorted = queryTasks({ inbox: true });
    const planned = today_.reduce((n, x) => n + (x.estimate ?? 0), 0), cap = Number(getSetting("capacity_min") ?? 360), ratio = cap ? planned / cap : 0;
    return (
      <FeatureGate feature="review"><div>{head}
        <div className="space-y-5">
          <Panel title="1 · Overdue: decide each one" count={overdue.length} i={1}><TriageList today={t} items={overdue.map(item)} actions={["today", "tomorrow", "nextweek", "someday", "done", "drop"]} empty="Nothing overdue. Nice." /></Panel>
          <Panel title="2 · Today's plan" count={today_.length} i={2} right={<span className={ratio > 1 ? "font-medium text-warn" : ""}>{fmtMinutes(planned)} of {fmtMinutes(cap)}</span>}>
            {planned > 0 && <div className="mx-4 mb-2 h-1.5 overflow-hidden rounded-full bg-raise"><div className={`h-full rounded-full ${ratio > 1.25 ? "bg-danger" : ratio > 1 ? "bg-warn" : "bg-ok"}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>}
            {ratio > 1 && <p className="mx-4 mb-2 text-xs text-warn">Over capacity by {fmtMinutes(planned - cap)}. Move something to tomorrow.</p>}
            <TriageList today={t} items={today_.map(item)} actions={["tomorrow", "nextweek", "done"]} empty="Nothing scheduled for today yet. Pull something in from the inbox below." /></Panel>
          <Panel title="3 · Inbox: pull in what matters" count={unsorted.length} i={3}><TriageList today={t} items={unsorted.map(item)} actions={["today", "tomorrow", "nextweek", "drop"]} empty="Inbox is clear." /></Panel>
        </div></div>
      </FeatureGate>
    );
  }
  const r = weeklyReview(t);
  const byDay = new Map<string, typeof r.done>(); for (const d of r.done) byDay.set(d.done_date, [...(byDay.get(d.done_date) ?? []), d]);
  const stat = (v: React.ReactNode, l: string) => <div className="px-4 py-3.5"><div className="text-2xl font-semibold leading-none">{v}</div><div className="mt-1.5 text-xs text-mute">{l}</div></div>;
  return (
    <FeatureGate feature="review"><div>{head}
      <div className="space-y-5">
        <Panel i={1} bodyClass="grid grid-cols-2 divide-x sm:grid-cols-4">
          {stat(r.done.length, "Completed this week")}{stat(r.overdue.length, "Overdue now")}{isOn("focus") ? stat(<>{r.focusMinutes}<span className="text-sm font-medium text-mute"> min</span></>, "Focused") : stat(r.nextWeek.length, "Due next week")}{stat(r.undated, "Unsorted in inbox")}
        </Panel>
        <Panel title="What you got done" count={r.done.length} i={2}>
          {r.done.length ? [...byDay].map(([d, ts]) => (<div key={d}><div className="border-y bg-raise/40 px-4 py-1.5 text-xs font-semibold text-mute first:border-t-0">{nice(d)} <span className="font-normal text-dim">{ts.length}</span></div>
            <ul>{ts.map((x) => <li key={x.id} className="flex items-center gap-2.5 border-b px-4 py-2 text-[14px] last:border-b-0"><span className="text-ok">✓</span><span className="truncate">{x.title}</span>{x.project_name && <span className="ml-auto text-xs text-mute">{x.project_name}</span>}</li>)}</ul></div>))
            : <p className="px-4 pb-4 text-sm text-mute">Nothing completed in the last 7 days yet.</p>}
        </Panel>
        <Panel title="Carry-over: decide what to do with overdue" count={r.overdue.length} i={3}><TriageList today={t} items={r.overdue.map(item)} actions={["today", "tomorrow", "nextweek", "someday", "done", "drop"]} empty="Nothing overdue. Clean slate." /></Panel>
        <Panel title="Looking ahead: next 7 days" count={r.nextWeek.length} i={4} bodyClass="px-2 pb-2"><TaskGroups groups={[{ label: "Coming up", tasks: r.nextWeek.slice(0, 12) }]} empty="Nothing scheduled for next week." /></Panel>
        {r.stale.length > 0 && <p className="px-1 text-[13px] text-mute">{r.stale.length} {r.stale.length === 1 ? "task has" : "tasks have"} been overdue for over two weeks. They&apos;re in the carry-over list above. Be honest about whether you&apos;ll do them.</p>}
      </div></div>
    </FeatureGate>
  );
}
