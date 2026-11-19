import { guard, json } from "@/lib/api";
import { currency, monthOf, monthSummary } from "@/lib/money";
import { today } from "@/lib/time";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const g = guard(req, "money"); if (g) return g;
  const m = new URL(req.url).searchParams.get("month") ?? monthOf(today()), s = monthSummary(m);
  return json({ month: m, currency: currency(), income: s.income_cents / 100, spent: s.spent_cents / 100, budgeted: s.budgeted_cents / 100, remaining: s.remaining_cents / 100, projected_spend: s.projected_cents / 100,
    categories: s.rows.map((r) => ({ name: r.category.name, spent: r.spent / 100, budget: r.budget / 100, percent: r.pct })) });
}
