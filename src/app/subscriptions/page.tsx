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
import { CYCLES, advanceSubscriptions, listSubs, monthlyCents, priceChange, subsSummary, yearlyCents } from "@/lib/subs";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
const PRESETS = ["Netflix", "Spotify", "YouTube Premium", "iCloud+", "Google One", "ChatGPT", "Claude", "GitHub", "Adobe", "Microsoft 365", "Amazon Prime", "Disney+", "Gym", "Internet", "Phone plan"];
const when = (d: string, t: string) => { const n = diffDays(d, t); return n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 && n < 14 ? `in ${n} days` : n < 0 ? `${-n} days ago` : nice(d).replace(",", ""); };

export default function Subscriptions() {
  const t = today(), cur = currency(), f = (c: number, o?: { compact?: boolean }) => fmtMoney(c, cur, o);
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
          <div className="text-right"><div className="text-[15px] font-semibold tabular-nums">{f(s.amount_cents)}<span className="text-xs font-normal text-mute"> /{s.cycle.replace("ly", "").replace("month", "mo").replace("year", "yr").replace("week", "wk").replace("quarter", "qtr")}</span></div>
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
        {[["Per month", f(sum.monthly_cents), ""], ["Per year", f(sum.yearly_cents, { compact: true }), ""], ["Active", String(sum.active), ""], ["Still to pay this month", f(sum.remaining_this_month_cents), ""]].map(([l, v], i) => <div key={l} className={`px-4 py-4 ${i > 1 ? "border-t sm:border-t-0" : ""}`}><div className="text-xs text-mute">{l}</div><div className="mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums">{v}</div></div>)}
        {top && <div className="col-span-2 border-t px-4 py-2.5 text-[13px] text-mute sm:col-span-4">Your biggest is <b className="text-fg">{top.name}</b> at {f(monthlyCents(top))}/month ({Math.round((monthlyCents(top) / Math.max(1, sum.monthly_cents)) * 100)}% of the total).</div>}
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
            <div className="flex gap-2"><input name="amount" required inputMode="decimal" placeholder="Price" aria-label="Price" className="field text-right" /><select name="cycle" className="field !w-32" aria-label="Billing cycle" defaultValue="monthly">{CYCLES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select></div>
            <label className="block text-xs text-mute">Next payment<input type="date" name="next_due" className="field mt-1" /></label>
            <label className="block text-xs text-mute">Free trial ends (optional)<input type="date" name="trial_ends" className="field mt-1" /></label>
            <select name="category_id" className="field" aria-label="Category"><option value="">Category: Subscriptions</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <div className="flex items-center justify-between gap-2 text-[13px]"><label className="flex items-center gap-1.5"><input type="checkbox" name="auto_log" defaultChecked />Log payments automatically</label><label className="flex items-center gap-1.5 text-mute">Remind <input name="remind_days" type="number" min={0} max={30} defaultValue={3} className="field !h-7 !w-14 !px-2 text-center" /> days before</label></div>
            <button className="btn-primary w-full">Add subscription</button>
          </form>
        </Panel>
      </div>
    </FeatureGate>
  );
}
