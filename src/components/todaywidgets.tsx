import { eventsOn } from "@/lib/calendar";
import { isOn } from "@/lib/features";
import { goalProgress, listGoals } from "@/lib/goals";
import { overdueCatchUps, upcomingBirthdays } from "@/lib/people";
import Link from "next/link";
import { getEntry } from "@/lib/journal";
import { habitsToday } from "@/lib/habits";
import { today } from "@/lib/time";
import { HabitCheck } from "./habitui";
import { Icon } from "./Icon";
import { MoodPicker } from "./mood";
import { Panel } from "./Panel";

export function HabitsPanel({ i = 0 }: { i?: number }) {
  const hs = habitsToday().filter((h) => h.scheduled);
  const done = hs.filter((h) => h.done).length;
  return (
    <Panel title="Habits" count={hs.length ? `${done}/${hs.length}` : undefined} i={i} right={<Link href="/habits" className="font-medium text-accent hover:underline">Manage</Link>}>
      {hs.length ? (
        <ul className="pb-1.5">{hs.map((h) => (
          <li key={h.id} className="flex items-center gap-3 px-4 py-2"><HabitCheck id={h.id} done={h.done} scheduled color={h.color} />
            <span className={`flex-1 text-[14px] ${h.done ? "text-dim" : ""}`}>{h.name}</span>
            {h.streak > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-warn" title={`${h.streak} day streak`}><Icon name="flame" size={13} />{h.streak}</span>}</li>))}</ul>
      ) : <p className="px-4 pb-4 text-sm text-mute">No habits scheduled today. <Link href="/habits" className="font-medium text-accent hover:underline">Add one</Link></p>}
    </Panel>
  );
}
export function JournalPanel({ i = 0 }: { i?: number }) {
  const t = today(), e = getEntry(t);
  return (
    <Panel title="Journal" i={i} right={<Link href="/journal" className="font-medium text-accent hover:underline">{e?.body ? "Continue" : "Write"}</Link>}>
      <div className="px-4 pb-4">
        <p className="mb-2.5 text-[13px] text-mute">How are you feeling today?</p>
        <MoodPicker date={t} value={e?.mood ?? null} compact />
        {e?.body && <p className="mt-3 line-clamp-2 text-[13px] text-mute">{e.body}</p>}
      </div>
    </Panel>
  );
}

import { currency, monthOf, monthSummary, budgetAlerts } from "@/lib/money";
import { fmtMoney } from "@/lib/moneyfmt";
import { advanceSubscriptions, listSubs, subsSummary } from "@/lib/subs";
import { diffDays } from "@/lib/dates";

export function MoneyPanel({ i = 0 }: { i?: number }) {
  const t = today(), cur = currency(), m = monthOf(t), s = monthSummary(m, t), al = budgetAlerts(m), pct = s.budgeted_cents ? Math.round((s.spent_cents / s.budgeted_cents) * 100) : 0;
  return (
    <Panel title="Money this month" i={i} right={<Link href="/money" className="font-medium text-accent hover:underline">Budget</Link>}>
      <div className="px-4 pb-4">
        <div className="flex items-baseline justify-between"><span className="text-[24px] font-semibold tabular-nums">{fmtMoney(s.spent_cents, cur, { compact: true })}</span><span className="text-xs text-mute">of {fmtMoney(s.budgeted_cents, cur, { compact: true })}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raise"><div className={`h-full rounded-full ${pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warn" : "bg-ok"}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
        <p className="mt-2 text-xs text-mute">{al.length ? <span className="text-warn">{al[0].category.name} is at {al[0].pct}%{al.length > 1 ? ` · +${al.length - 1} more` : ""}</span> : s.budgeted_cents ? `${fmtMoney(Math.abs(s.remaining_cents), cur, { compact: true })} ${s.remaining_cents >= 0 ? "left" : "over"} · ${pct}% used` : "Set budgets to track your month."}</p>
      </div>
    </Panel>
  );
}
export function RenewalsPanel({ i = 0 }: { i?: number }) {
  const t = today(), cur = currency(); advanceSubscriptions(t);
  const soon = listSubs("active").filter((s) => s.next_due >= t).sort((a, b) => a.next_due.localeCompare(b.next_due)).slice(0, 3), sum = subsSummary(t);
  return (
    <Panel title="Upcoming renewals" i={i} right={<Link href="/subscriptions" className="font-medium text-accent hover:underline">All</Link>}>
      <ul className="pb-1.5">{soon.map((s) => { const d = diffDays(s.next_due, t); return <li key={s.id} className="flex items-center gap-3 px-4 py-1.5 text-[13px]"><span className="min-w-0 flex-1 truncate font-medium">{s.name}</span><span className={`text-xs ${d <= 3 ? "font-medium text-warn" : "text-mute"}`}>{d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d}d`}</span><span className="w-16 text-right tabular-nums">{fmtMoney(s.amount_cents, cur)}</span></li>; })}
        {!soon.length && <li className="px-4 py-2 text-sm text-mute">Nothing renewing soon.</li>}</ul>
      <p className="border-t px-4 py-2 text-xs text-mute">{fmtMoney(sum.monthly_cents, cur)} a month across {sum.active} subscriptions</p>
    </Panel>
  );
}

export function EventsPanel({ i = 0 }: { i?: number }) {
  const t = today(), ev = eventsOn(t).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return (
    <Panel title="Calendar" i={i} right={isOn("planner") ? <Link href="/planner" className="font-medium text-accent hover:underline">Planner</Link> : undefined}>
      <ul className="pb-1.5">{ev.slice(0, 6).map((e) => <li key={e.id} className="flex items-center gap-3 px-4 py-1.5 text-[13px]"><span className="w-12 shrink-0 tabular-nums text-mute">{e.all_day ? "All day" : e.start_time}</span><span className="min-w-0 flex-1 truncate">{e.title}</span></li>)}
        {!ev.length && <li className="px-4 py-2 text-sm text-mute">No events today.</li>}</ul>
    </Panel>
  );
}
export function PeoplePanel({ i = 0 }: { i?: number }) {
  const t = today(), b = upcomingBirthdays(14, t).slice(0, 3), c = overdueCatchUps(t).slice(0, 3);
  if (!b.length && !c.length) return null;
  return (
    <Panel title="People" i={i} right={<Link href="/people" className="font-medium text-accent hover:underline">All</Link>}>
      <ul className="pb-1.5">{b.map(({ p, b: x }) => <li key={"b" + p.id} className="flex items-center gap-3 px-4 py-1.5 text-[13px]"><span className="min-w-0 flex-1 truncate font-medium">{p.name}&apos;s birthday</span><span className="text-xs text-mute">{x!.in === 0 ? "today" : `in ${x!.in}d`}</span></li>)}
        {c.map(({ p }) => <li key={"c" + p.id} className="flex items-center gap-3 px-4 py-1.5 text-[13px]"><span className="min-w-0 flex-1 truncate">Catch up with {p.name}</span><span className="text-xs text-warn">due</span></li>)}</ul>
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
