import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { Icon } from "@/components/Icon";
import { BudgetCell, Contribute } from "@/components/moneyui";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { addCategoryAction, addSavingAction, addStarterCategoriesAction, addTransactionAction, archiveCategoryAction, archiveSavingAction } from "@/lib/actions";
import { isOn } from "@/lib/features";
import { budgetAlerts, currency, listCategories, listSavings, listTransactions, monthOf, monthSummary, savingNeeded, shiftMonth } from "@/lib/money";
import { fmtMoney } from "@/lib/moneyfmt";
import { advanceSubscriptions, subsSummary } from "@/lib/subs";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
const tone = (p: number) => (p >= 100 ? "bg-danger" : p >= 80 ? "bg-warn" : "bg-ok");

export default async function Money({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const t = today(), cur = currency(), f = (c: number, o?: { sign?: boolean; compact?: boolean }) => fmtMoney(c, cur, o);
  const m = (await searchParams).m, month = m && /^\d{4}-\d{2}$/.test(m) ? m : monthOf(t);
  if (isOn("subscriptions")) advanceSubscriptions(t);
  const cats = listCategories(), sm = monthSummary(month, t), isNow = month === monthOf(t);
  const label = new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(month + "-01T00:00:00Z"));
  const recent = listTransactions({ month, limit: 8 }), savings = listSavings(), subs = isOn("subscriptions") ? subsSummary(t) : null, alerts = isNow ? budgetAlerts(month) : [];
  const left = sm.remaining_cents, over = sm.projected_cents - sm.budgeted_cents;
  const nav = "btn !h-8 !px-2.5";
  return (
    <FeatureGate feature="money">
      <PageHead title="Budget" sub={label} right={<>
        <Link href={`/money?m=${shiftMonth(month, -1)}`} className={nav} aria-label="Previous month">‹</Link>{!isNow && <Link href="/money" className="btn !h-8">This month</Link>}<Link href={`/money?m=${shiftMonth(month, 1)}`} className={nav} aria-label="Next month">›</Link>
        <Link href="/money/transactions" className="btn !h-8"><Icon name="list" size={15} />Transactions</Link></>} />
      {!cats.length ? (
        <div className="rise rounded-xl border border-dashed px-6 py-12 text-center"><span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent"><Icon name="wallet" size={24} /></span>
          <p className="font-medium">Set up your budget</p><p className="mx-auto mt-1 max-w-sm text-sm text-mute">Start with common categories, then give each a monthly amount. You can rename, add and remove them any time.</p>
          <form action={addStarterCategoriesAction} className="mt-4"><button className="btn-primary">Add starter categories</button></form></div>
      ) : (<>
        {alerts.length > 0 && <div className="rise mb-4 flex flex-wrap gap-2">{alerts.map((a) => <span key={a.category.id} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] ${a.level === 100 ? "border-danger/40 bg-danger/10 text-danger" : "border-warn/40 bg-warn/10 text-warn"}`}><Icon name="bell" size={14} />{a.category.name} is at {a.pct}% of budget</span>)}</div>}
        <Panel i={0} className="mb-4" bodyClass="grid grid-cols-2 divide-x sm:grid-cols-4">
          {[["Income", f(sm.income_cents), "text-ok"], ["Spent", f(sm.spent_cents), ""], ["Budgeted", f(sm.budgeted_cents), ""], [left >= 0 ? "Left to spend" : "Over budget", f(Math.abs(left)), left >= 0 ? "text-ok" : "text-danger"]].map(([l, v, c], i) => (
            <div key={l} className={`px-4 py-4 ${i > 1 ? "border-t sm:border-t-0" : ""}`}><div className="text-xs text-mute">{l}</div><div className={`mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums ${c}`}>{v}</div></div>))}
          {isNow && sm.budgeted_cents > 0 && <div className="col-span-2 border-t px-4 py-2.5 text-[13px] text-mute sm:col-span-4">At this pace you&apos;ll spend <b className="text-fg">{f(sm.projected_cents)}</b> by month end{over > 0 ? <>, <span className="font-medium text-danger">{f(over)} over budget</span>.</> : <>, <span className="font-medium text-ok">{f(-over)} under budget</span>.</>} <span className="text-dim">Day {sm.dayOfMonth} of {sm.daysInMonth}.</span></div>}
        </Panel>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <Panel title="Spending by category" i={1} right={<span>{f(sm.spent_cents)} of {f(sm.budgeted_cents)}</span>}>
              <ul>{sm.rows.map((r) => (
                <li key={r.category.id} className="group border-b px-4 py-3 last:border-b-0">
                  <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.category.color }} />
                    <Link href={`/money/transactions?m=${month}&category=${r.category.id}`} className="min-w-0 flex-1 truncate text-[14px] font-medium hover:underline">{r.category.name}</Link>
                    <span className="text-[13px] tabular-nums">{f(r.spent)}</span><span className="text-dim">/</span>
                    <BudgetCell id={r.category.id} month={month} budget={r.budget} cur={cur} isDefault={r.budget === r.category.budget_cents} />
                    <form action={archiveCategoryAction.bind(null, r.category.id)}><button aria-label="Remove category" className="rounded p-1 text-dim opacity-0 hover:text-danger group-hover:opacity-100 [@media(hover:none)]:opacity-100"><Icon name="x" size={14} /></button></form></div>
                  <div className="mt-2 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raise"><div className={`h-full rounded-full ${tone(r.pct)}`} style={{ width: `${Math.min(100, r.pct)}%` }} /></div>
                    <span className={`w-28 text-right text-xs ${r.budget && r.spent > r.budget ? "text-danger" : "text-mute"}`}>{r.budget ? (r.spent > r.budget ? `${f(r.spent - r.budget)} over` : `${f(r.budget - r.spent)} left`) : "no budget"}</span></div>
                </li>))}
                {sm.uncategorized_cents < 0 && <li className="border-b px-4 py-3 text-[13px]"><Link href={`/money/transactions?m=${month}&category=none`} className="flex items-center justify-between hover:underline"><span className="flex items-center gap-2 text-mute"><Icon name="inbox" size={14} />Uncategorised</span><span className="tabular-nums">{f(-sm.uncategorized_cents)}</span></Link></li>}
              </ul>
              {sm.incomeRows.some((r) => r.received) && <div className="border-t bg-raise/30 px-4 py-2 text-xs font-semibold text-mute">Income</div>}
              <ul>{sm.incomeRows.filter((r) => r.received).map((r) => <li key={r.category.id} className="flex items-center justify-between border-b px-4 py-2.5 text-[14px] last:border-b-0"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: r.category.color }} />{r.category.name}</span><span className="tabular-nums text-ok">{f(r.received, { sign: true })}</span></li>)}</ul>
              <details className="border-t px-4 py-3 text-sm"><summary className="cursor-pointer text-[13px] font-medium text-accent">Add a category</summary>
                <form action={addCategoryAction} className="mt-3 flex flex-wrap gap-2"><input name="name" required placeholder="e.g. Pets" className="field min-w-0 flex-1 basis-40" /><input name="budget" inputMode="decimal" placeholder="Monthly budget" className="field !w-36" />
                  <select name="kind" className="field !w-28"><option value="expense">Expense</option><option value="income">Income</option></select><input type="color" name="color" defaultValue="#1877f2" aria-label="Colour" className="h-[38px] w-11 border" /><button className="btn-primary">Add</button></form></details>
            </Panel>
          </div>
          <aside className="space-y-4">
            <Panel title="Add transaction" i={2}>
              <form action={addTransactionAction} className="space-y-2.5 px-4 pb-4">
                <div className="flex gap-2"><select name="kind" className="field !w-28" aria-label="Type"><option value="expense">Expense</option><option value="income">Income</option></select><input name="amount" required inputMode="decimal" placeholder="Amount" aria-label="Amount" className="field text-right" /></div>
                <input name="payee" placeholder="Payee, e.g. Countdown" className="field" />
                <div className="flex gap-2"><select name="category_id" className="field" aria-label="Category"><option value="">Auto / none</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="date" name="date" defaultValue={t} className="field !w-40" aria-label="Date" /></div>
                <button className="btn-primary w-full">Add</button><p className="text-xs text-dim">Tip: type <code className="rounded bg-raise px-1">$12.50 flat white @eating-out</code> in the capture bar.</p></form>
            </Panel>
            <Panel title="Recent" i={3} right={<Link href="/money/transactions" className="font-medium text-accent hover:underline">All</Link>}>
              <ul className="pb-1.5">{recent.map((x) => <li key={x.id} className="flex items-center gap-3 px-4 py-2 text-[13px]"><div className="min-w-0 flex-1"><div className="truncate font-medium">{x.payee || "(no payee)"}</div><div className="text-xs text-mute">{x.date.slice(5)} · {x.category_name ?? "Uncategorised"}</div></div><span className={`tabular-nums ${x.amount_cents > 0 ? "text-ok" : ""}`}>{f(x.amount_cents, { sign: true })}</span></li>)}
                {!recent.length && <li className="px-4 py-3 text-sm text-mute">Nothing logged this month yet.</li>}</ul>
            </Panel>
            {subs && <Panel title="Subscriptions" i={4} right={<Link href="/subscriptions" className="font-medium text-accent hover:underline">Manage</Link>}>
              <div className="px-4 pb-4"><div className="text-[24px] font-semibold tabular-nums">{f(subs.monthly_cents)}<span className="text-sm font-normal text-mute"> /month</span></div>
                <p className="mt-1 text-xs text-mute">{subs.active} active · {f(subs.yearly_cents, { compact: true })} a year{subs.next ? <> · next: {subs.next.name} on {subs.next.next_due.slice(5)}</> : null}</p></div></Panel>}
            <Panel title="Savings goals" i={5}>
              <ul>{savings.map((s) => { const pct = Math.min(100, Math.round((s.saved_cents / s.target_cents) * 100)), need = savingNeeded(s, t); return (
                <li key={s.id} className="group border-b px-4 py-3 last:border-b-0"><div className="flex items-center justify-between"><span className="text-[14px] font-medium">{s.name}</span><form action={archiveSavingAction.bind(null, s.id)}><button aria-label="Remove goal" className="rounded p-1 text-dim opacity-0 hover:text-danger group-hover:opacity-100 [@media(hover:none)]:opacity-100"><Icon name="x" size={13} /></button></form></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} /></div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-mute"><span>{f(s.saved_cents, { compact: true })} of {f(s.target_cents, { compact: true })} · {pct}%{need ? ` · ${f(need, { compact: true })}/mo to hit ${s.due!.slice(0, 7)}` : ""}</span><Contribute id={s.id} /></div></li>); })}</ul>
              <details className="border-t px-4 py-3"><summary className="cursor-pointer text-[13px] font-medium text-accent">New savings goal</summary>
                <form action={addSavingAction} className="mt-3 space-y-2"><input name="name" required placeholder="e.g. Holiday fund" className="field" /><div className="flex gap-2"><input name="target" required inputMode="decimal" placeholder="Target" className="field" /><input type="date" name="due" className="field !w-40" aria-label="Target date" /></div><button className="btn-primary">Create</button></form></details>
            </Panel>
          </aside>
        </div>
      </>)}
    </FeatureGate>
  );
}
