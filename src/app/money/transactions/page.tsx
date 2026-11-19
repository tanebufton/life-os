import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { Icon } from "@/components/Icon";
import { CsvImport, DeleteTx, TxCategory } from "@/components/moneyui";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { FilterChip } from "@/components/chip";
import { currency, listCategories, listRules, listTransactions, monthOf, shiftMonth } from "@/lib/money";
import { fmtMoney } from "@/lib/moneyfmt";
import { today } from "@/lib/time";
import { deleteRuleAction } from "@/lib/actions2";

export const dynamic = "force-dynamic";
export default async function Transactions({ searchParams }: { searchParams: Promise<{ m?: string; category?: string; q?: string }> }) {
  const sp = await searchParams, t = today(), cur = currency();
  const month = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : sp.m === "all" ? undefined : monthOf(t);
  const cat = sp.category === "none" ? "none" : Number(sp.category) || undefined;
  const cats = listCategories(), rows = listTransactions({ month, category: cat, q: sp.q, limit: 300 }), rules = listRules();
  const qs = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(Object.entries({ m: month ?? "all", category: sp.category, q: sp.q, ...o }).filter(([, v]) => v) as [string, string][]).toString(); return `/money/transactions${p ? "?" + p : ""}`; };
  const total = rows.reduce((n, r) => n + r.amount_cents, 0);
  return (
    <FeatureGate feature="money">
      <div className="max-w-5xl">
        <PageHead title="Transactions" sub={`${rows.length} shown · net ${fmtMoney(total, cur, { sign: true })}`} right={<Link href="/money" className="btn !h-8">Back to budget</Link>} />
        <Panel title="Import from your bank" i={0} className="mb-4"><details><summary className="cursor-pointer px-4 pb-3 text-[13px] font-medium text-accent">Upload a CSV statement</summary><CsvImport cur={cur} /></details></Panel>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {month && <><FilterChip href={qs({ m: shiftMonth(month, -1) })}>‹</FilterChip><FilterChip href={qs({})} active>{new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(month + "-01T00:00:00Z"))}</FilterChip><FilterChip href={qs({ m: shiftMonth(month, 1) })}>›</FilterChip></>}
          <FilterChip href={qs({ m: month ? "all" : monthOf(t) })} active={!month}>All time</FilterChip>
          <FilterChip href={qs({ category: undefined })} active={!sp.category}>All categories</FilterChip><FilterChip href={qs({ category: "none" })} active={sp.category === "none"}>Uncategorised</FilterChip>
          <form className="ml-auto flex gap-1.5">{month ? <input type="hidden" name="m" value={month} /> : <input type="hidden" name="m" value="all" />}{sp.category && <input type="hidden" name="category" value={sp.category} />}<input name="q" defaultValue={sp.q} placeholder="Search payee" className="field !h-8 !w-44 text-[13px]" /></form>
        </div>
        <Panel i={1}>
          <ul>{rows.map((x) => (
            <li key={x.id} className="group flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 last:border-b-0 hover:bg-raise/50">
              <span className="w-14 shrink-0 text-xs tabular-nums text-mute">{x.date.slice(5)}</span>
              <div className="min-w-0 flex-1 basis-40"><div className="truncate text-[14px] font-medium">{x.payee || "(no payee)"}</div>{x.source !== "manual" && <span className="text-[11px] text-dim">{x.source}</span>}</div>
              <TxCategory id={x.id} value={x.category_id} cats={cats} payee={x.payee} />
              <span className={`w-24 text-right text-[14px] tabular-nums ${x.amount_cents > 0 ? "text-ok" : ""}`}>{fmtMoney(x.amount_cents, cur, { sign: true })}</span><DeleteTx id={x.id} />
            </li>))}
            {!rows.length && <li className="px-4 py-10 text-center text-sm text-mute">No transactions match.</li>}</ul>
        </Panel>
        {rules.length > 0 && <Panel title="Auto-categorise rules" count={rules.length} i={2} className="mt-4"><ul className="pb-1.5">{rules.map((r) => <li key={r.id} className="flex items-center justify-between px-4 py-1.5 text-[13px]"><span>“{r.pattern}” <span className="text-mute">→</span> {r.category}</span><form action={deleteRuleAction.bind(null, r.id)}><button aria-label="Delete rule" className="rounded p-1 text-dim hover:text-danger"><Icon name="x" size={13} /></button></form></li>)}</ul></Panel>}
      </div>
    </FeatureGate>
  );
}
