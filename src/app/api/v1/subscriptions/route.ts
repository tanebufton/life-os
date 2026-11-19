import { guard, json } from "@/lib/api";
import { currency } from "@/lib/money";
import { CYCLES, advanceSubscriptions, createSub, listSubs, monthlyCents, subsSummary } from "@/lib/subs";
import { toCents } from "@/lib/moneyfmt";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const g = guard(req, "subscriptions"); if (g) return g;
  advanceSubscriptions(); const s = subsSummary();
  return json({ currency: currency(), monthly_total: s.monthly_cents / 100, yearly_total: s.yearly_cents / 100,
    subscriptions: listSubs().map((x) => ({ id: x.id, name: x.name, amount: x.amount_cents / 100, cycle: x.cycle, monthly_cost: monthlyCents(x) / 100, next_due: x.next_due, status: x.status, trial_ends: x.trial_ends })) });
}
export async function POST(req: Request) {
  const g = guard(req, "subscriptions"); if (g) return g;
  const b = (await req.json().catch(() => null)) as { name?: string; amount?: number; cycle?: string; next_due?: string; trial_ends?: string } | null;
  if (!b?.name?.trim() || typeof b.amount !== "number" || b.amount < 0) return json({ error: "name and a non-negative numeric amount are required" }, 400);
  if (b.cycle && !CYCLES.includes(b.cycle as never)) return json({ error: `cycle must be one of ${CYCLES.join(", ")}` }, 400);
  try { return json({ id: createSub({ name: b.name, amount_cents: toCents(b.amount), cycle: b.cycle as never, next_due: b.next_due, trial_ends: b.trial_ends }) }, 201); } catch (e) { return json({ error: (e as Error).message }, 400); }
}
