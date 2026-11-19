import { FeatureGate } from "@/components/FeatureGate";
import { Icon } from "@/components/Icon";
import { SubMenu } from "@/components/moneyui";
import { ProjectAvatar } from "@/components/Pill";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { addSubAction } from "@/lib/actions";
import { diffDays, nice } from "@/lib/dates";
import { currency, listCategories } from "@/lib/money";
import { fmtMoney } from "@/lib/moneyfmt";
import { MarkAllPaid, PayTick } from "@/components/payrun";
import Link from "next/link";
import { CYCLES, CYCLE_LABEL, CYCLE_SHORT, PERIODS, chargesBetween, periodRange, shiftPeriod, type Period, advanceSubscriptions, listSubs, monthlyCents, priceChange, subsSummary, yearlyCents } from "@/lib/subs";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
const PRESETS = ["Netflix", "Spotify", "YouTube Premium", "iCloud+", "Google One", "ChatGPT", "Claude", "GitHub", "Adobe", "Microsoft 365", "Amazon Prime", "Disney+", "Gym", "Internet", "Phone plan"];
const when = (d: string, t: string) => { const n = diffDays(d, t); return n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 && n < 14 ? `in ${n} days` : n < 0 ? `${-n} days ago` : nice(d).replace(",", ""); };

export default async function Subscriptions({ searchParams }: { searchParams: Promise<{ period?: string; d?: string }> }) {
  const sp = await searchParams, t = today(), period = (PERIODS.some((x) => x.k === sp.period) ? sp.period : "month") as Period, anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : t, range = periodRange(period, anchor), charges = chargesBetween(range.from, range.to);
  const href = (o: { period?: Period; d?: string }) => `/subscriptions?period=${o.period ?? period}&d=${o.d ?? anchor}`, left = charges.filter((c) => !c.paid), leftSum = left.reduce((n, c) => n + c.amount_cents, 0), totalSum = charges.reduce((n, c) => n + c.amount_cents, 0);
  const dm = (d: string) => new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(d + "T00:00:00Z")), rangeLabel = period === "year" ? range.from.slice(0, 4) : `${dm(range.from)} – ${dm(range.to)}`;
  const cur = currency(), f = (c: number, o?: { compact?: boolean }) => fmtMoney(c, cur, o);
  advanceSubscriptions(t);
  const all = listSubs(), active = all.filter((s) => s.status === "active"), inactive = all.filter((s) => s.status !== "active"), sum = subsSummary(t), cats = listCategories("expense");
  const top = [...active].sort((a, b) => monthlyCents(b) - monthlyCents(a))[0];
  const Row = ({ s, i }: { s: (typeof all)[number]; i: number }) => {
    const pc = priceChange(s.id), d = diffDays(s.next_due, t), trial = s.trial_ends && s.trial_ends >= t;
    return (
      <li className="rise border-b px-4 py-3.5 last:border-b-0" style={{ ["--i" as string]: i }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ProjectAvatar name={s.name} color={s.color} size={36} />
          <div className="min-w-0 flex-1 basis-44"><div className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{s.name}</span>
            {trial && <span className="lozenge bg-warn/15 text-warn">Trial ends {when(s.trial_ends!, t)}</span>}{s.status === "paused" && <span className="lozenge bg-raise text-mute">Paused</span>}{s.status === "cancelled" && <span className="lozenge bg-raise text-mute">Cancelled</span>}
            {pc && <span className="lozenge bg-danger/10 text-danger" title={`Was ${f(pc.from)}`}>{pc.to > pc.from ? "▲" : "▼"} {f(Math.abs(pc.to - pc.from))}</span>}</div>
            <div className="text-xs text-mute">{s.status === "active" ? <>Renews <span className={d <= 3 ? "font-medium text-warn" : ""}>{when(s.next_due, t)}</span> · {s.auto_log ? "auto-logged" : "log manually"}</> : s.cancelled_at ? `Cancelled ${s.cancelled_at}` : "Not counting toward your total"}</div></div>
          <div className="text-right"><div className="text-[15px] font-semibold tabular-nums">{f(s.amount_cents)}<span className="text-xs font-normal text-mute"> /{CYCLE_SHORT[s.cycle]}</span></div>
            <div className="text-xs text-dim">{f(monthlyCents(s))}/mo · {f(yearlyCents(s), { compact: true })}/yr</div></div>
        </div>
        <div className="mt-2.5 pl-[52px]"><SubMenu id={s.id} status={s.status} autoLog={!!s.auto_log} /></div>
      </li>
    );
  };
  return (
    <FeatureGate feature="subscriptions">
      <PageHead title="Subscriptions" sub="Everything that renews, in one place" />
      <Panel i={0} className="mb-4" bodyClass="grid grid-cols-2 divide-x sm:grid-cols-4">
        {[["Per month", f(sum.monthly_cents), ""], ["Per year", f(sum.yearly_cents, { compact: true }), ""], ["Active", String(sum.active), ""], ["Still to pay this month", f(sum.remaining_this_month_cents), ""]].map(([l, v], i) => <div key={l} className={`px-4 py-4 ${i > 1 ? "border-t sm:border-t-0" : ""}`}><div className="text-xs text-mute">{l}</div><div className="mt-1 text-[20px] font-semibold leading-none sm:text-[26px] tracking-tight tabular-nums">{v}</div></div>)}
        {top && <div className="col-span-2 border-t px-4 py-2.5 text-[13px] text-mute sm:col-span-4">Your biggest is <b className="text-fg">{top.name}</b> at {f(monthlyCents(top))}/month ({Math.round((monthlyCents(top) / Math.max(1, sum.monthly_cents)) * 100)}% of the total).</div>}
      </Panel>
      <Panel title="Pay run" i={1} className="mb-4" right={<MarkAllPaid from={range.from} to={range.to} left={left.length} />}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 pb-3">
          <div role="group" aria-label="Period" className="inline-flex rounded-lg border p-0.5 text-[13px]">{PERIODS.map((x) => <Link key={x.k} href={href({ period: x.k, d: t })} aria-current={x.k === period ? "true" : undefined} className={`rounded-md px-2.5 py-1 ${x.k === period ? "bg-raise font-medium" : "text-mute hover:text-fg"}`}>{x.label}</Link>)}</div>
          <div className="flex items-center gap-1 text-[13px]"><Link href={href({ d: shiftPeriod(period, anchor, -1) })} aria-label="Previous period" className="btn !px-2"><Icon name="chevDown" size={14} className="rotate-90" /></Link><span className="min-w-[9.5rem] text-center font-medium tabular-nums">{rangeLabel}</span><Link href={href({ d: shiftPeriod(period, anchor, 1) })} aria-label="Next period" className="btn !px-2"><Icon name="chevDown" size={14} className="-rotate-90" /></Link></div>
          <div className="ml-auto text-[13px] text-mute">{charges.length ? <><b className="text-fg">{charges.length - left.length}</b> of {charges.length} paid · <b className="text-fg">{f(leftSum)}</b> to go of {f(totalSum)}</> : "Nothing falls in this period"}</div>
        </div>
        <ul>{charges.map((c) => (
          <li key={`${c.sub_id}:${c.due}`} className={`flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0 ${c.paid ? "opacity-60" : ""}`}>
            <PayTick subId={c.sub_id} due={c.due} paid={c.paid} label={`${c.name}, ${nice(c.due)}`} />
            <ProjectAvatar name={c.name} color={c.color} size={24} /><span className={`min-w-0 flex-1 truncate text-[14px] ${c.paid ? "line-through" : ""}`}>{c.name}</span>
            <span className={`text-xs ${!c.paid && c.due < t ? "font-medium text-danger" : "text-mute"}`}>{!c.paid && c.due < t ? "Overdue · " : ""}{nice(c.due)}</span><span className="w-24 text-right text-[14px] font-medium tabular-nums">{f(c.amount_cents)}</span>
          </li>))}
          {!charges.length && <li className="px-4 py-8 text-center text-sm text-mute">No charges fall in this period. Try another, or add a subscription.</li>}</ul>
        <p className="px-4 pb-3 pt-2 text-xs text-dim">Ticking is your own record of what you&apos;ve paid. Spending is still logged by the automatic payments below.</p>
      </Panel>
      {(sum.trials.length > 0 || sum.dueSoon.length > 0) && (
        <div className="rise mb-4 space-y-2">{sum.trials.map((s) => <div key={s.id} className="flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-[13px] text-warn"><Icon name="bell" size={15} /><b>{s.name}</b> free trial ends {when(s.trial_ends!, t)}. Cancel before then if you don&apos;t want to be charged.</div>)}
          {sum.dueSoon.filter((s) => !s.trial_ends).slice(0, 3).map((s) => <div key={s.id} className="flex items-center gap-2 rounded-xl border bg-raise/40 px-4 py-2.5 text-[13px]"><Icon name="calendar" size={15} className="text-accent" /><b>{s.name}</b> renews {when(s.next_due, t)} for {f(s.amount_cents)}.</div>)}</div>)}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel title="Active" count={active.length} i={1}><ul>{active.map((s, i) => <Row key={s.id} s={s} i={i} />)}{!active.length && <li className="px-4 py-10 text-center text-sm text-mute">No subscriptions yet. Add your first on the right.</li>}</ul></Panel>
          {inactive.length > 0 && <Panel title="Paused & cancelled" count={inactive.length} i={2}><ul>{inactive.map((s, i) => <Row key={s.id} s={s} i={i} />)}</ul></Panel>}
        </div>
        <Panel title="Add a subscription" i={3}>
          <form action={addSubAction} className="space-y-2.5 px-4 pb-4">
            <input name="name" required list="presets" placeholder="Name, e.g. Netflix" className="field" /><datalist id="presets">{PRESETS.map((p) => <option key={p} value={p} />)}</datalist>
            <div className="flex gap-2"><input name="amount" required inputMode="decimal" placeholder="Price" aria-label="Price" className="field text-right" /><select name="cycle" className="field !w-32" aria-label="Billing cycle" defaultValue="monthly">{CYCLES.map((c) => <option key={c} value={c}>{CYCLE_LABEL[c]}</option>)}</select></div>
            <label className="block text-xs text-mute">Next payment<input type="date" name="next_due" className="field mt-1" /></label>
            <label className="block text-xs text-mute">Free trial ends (optional)<input type="date" name="trial_ends" className="field mt-1" /></label>
            <select name="category_id" className="field" aria-label="Category"><option value="">Category: Subscriptions</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="auto_log" defaultChecked />Log payments automatically</label>
            <label className="flex items-center gap-2 text-[13px] text-mute">Remind me <input name="remind_days" type="number" min={0} max={30} defaultValue={3} className="field !h-7 !w-14 !px-2 text-center" /> days before renewal</label>
            <button className="btn-primary w-full">Add subscription</button>
          </form>
        </Panel>
      </div>
    </FeatureGate>
  );
}
