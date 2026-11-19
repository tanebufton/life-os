import { body, err, guard, json } from "@/lib/api";
import { addTransaction, categoryByName, currency, listTransactions, monthOf } from "@/lib/money";
import { parseMoneyQuick, toCents } from "@/lib/moneyfmt";
import { listCategories } from "@/lib/money";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const g = guard(req, "money"); if (g) return g;
  const u = new URL(req.url).searchParams, cat = u.get("category");
  const rows = listTransactions({ month: u.get("month") ?? monthOf(today()), category: cat ? categoryByName(cat) ?? undefined : undefined, q: u.get("q") ?? undefined, limit: Math.min(Number(u.get("limit")) || 100, 500) });
  return json({ currency: currency(), transactions: rows.map((t) => ({ id: t.id, date: t.date, amount: t.amount_cents / 100, payee: t.payee, category: t.category_name, source: t.source })) });
}
/** POST {"text": "$12.50 coffee @eating-out"} or {"amount": -12.5, "payee": "Cafe", "category": "Eating out", "date": "2026-03-02"}. Negative = expense. Ideal for an iPhone "Apple Pay" automation. */
export async function POST(req: Request) {
  const g = guard(req, "money"); if (g) return g;
  const b = await body(req);
  try {
    let amount_cents: number, payee: string, category: string | undefined, date: string | undefined;
    if (typeof b.text === "string") { const q = parseMoneyQuick(b.text, today(), listCategories().map((c) => c.name)); if (!q) return err("Couldn't read an amount. Try \"$12.50 coffee\"."); ({ amount_cents, payee, category, date } = q); }
    else { const n = Number(b.amount); if (!Number.isFinite(n) || n === 0) return err("`amount` (non-zero number) or `text` is required"); amount_cents = toCents(n); payee = String(b.payee ?? ""); category = b.category; date = b.date; }
    const catId = category ? categoryByName(category, true) : undefined;
    const id = addTransaction({ date, amount_cents, payee, category_id: catId === null ? undefined : catId, source: "api" });
    return json({ id, amount: amount_cents / 100, payee, category: category ?? null }, 201);
  } catch (e) { return err((e as Error).message); }
}
