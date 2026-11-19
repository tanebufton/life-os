import crypto from "node:crypto";
import { db } from "./db";

import { getSetting } from "./settings";
import { today, tz } from "./time";

export const currency = () => getSetting("currency") ?? (tz().startsWith("Pacific/Auckland") ? "NZD" : "USD");
export type Category = { id: number; name: string; color: string; kind: "expense" | "income"; budget_cents: number; archived: number };
export type Tx = { id: number; date: string; amount_cents: number; payee: string; category_id: number | null; note: string; source: string; sub_id: number | null; category_name?: string | null; category_color?: string | null };
export const monthOf = (d: string) => d.slice(0, 7);
export const shiftMonth = (m: string, n: number) => { const [y, mo] = m.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1 + n, 1)); return t.toISOString().slice(0, 7); };
export const daysInMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };

// ---------- categories & budgets ----------
export const listCategories = (kind?: "expense" | "income"): Category[] =>
  db.prepare(`SELECT * FROM money_categories WHERE archived=0 ${kind ? "AND kind=?" : ""} ORDER BY kind DESC, name`).all(...(kind ? [kind] : [])) as Category[];
export const getCategory = (id: number) => db.prepare("SELECT * FROM money_categories WHERE id=?").get(id) as Category | undefined;
export function createCategory(name: string, o: { kind?: "expense" | "income"; color?: string; budget_cents?: number } = {}): number {
  const ex = db.prepare("SELECT id FROM money_categories WHERE lower(name)=lower(?) AND archived=0").get(name.trim()) as { id: number } | undefined;
  if (ex) return ex.id;
  return Number(db.prepare("INSERT INTO money_categories (name, color, kind, budget_cents) VALUES (?,?,?,?)").run(name.trim(), /^#[0-9a-f]{6}$/i.test(o.color ?? "") ? o.color : "#1877f2", o.kind ?? "expense", Math.max(0, o.budget_cents ?? 0)).lastInsertRowid);
}
export function categoryByName(name?: string | null, create = false): number | null {
  if (!name?.trim()) return null;
  const n = name.trim().toLowerCase().replace(/[-_]+/g, " ");
  const c = listCategories().find((x) => x.name.toLowerCase() === n) ?? listCategories().find((x) => x.name.toLowerCase().startsWith(n));
  return c ? c.id : create ? createCategory(name.trim().replace(/[-_]+/g, " ")) : null;
}
export const archiveCategory = (id: number) => db.prepare("UPDATE money_categories SET archived=1 WHERE id=?").run(id).changes > 0;
export const STARTERS: [string, string, "expense" | "income"][] = [["Groceries", "#1f845a", "expense"], ["Eating out", "#c46f00", "expense"], ["Transport", "#337ea9", "expense"], ["Housing", "#6366f1", "expense"], ["Utilities", "#0ea5e9", "expense"], ["Health", "#d44c47", "expense"], ["Fun", "#c14c8a", "expense"], ["Shopping", "#9065b0", "expense"], ["Subscriptions", "#64748b", "expense"], ["Savings", "#10b981", "expense"], ["Salary", "#16a34a", "income"], ["Other income", "#65a30d", "income"]];
export function addStarterCategories() { for (const [n, c, k] of STARTERS) createCategory(n, { color: c, kind: k }); }
export function budgetFor(cat: Category, month: string): number {
  const o = db.prepare("SELECT amount_cents FROM budget_overrides WHERE category_id=? AND month=?").get(cat.id, month) as { amount_cents: number } | undefined;
  return o ? o.amount_cents : cat.budget_cents;
}
/** Set this month's budget. `asDefault` also makes it the standing monthly amount. */
export function setBudget(catId: number, month: string, cents: number, asDefault = false) {
  const c = getCategory(catId); if (!c) return false; cents = Math.max(0, Math.round(cents));
  if (asDefault) { db.prepare("UPDATE money_categories SET budget_cents=? WHERE id=?").run(cents, catId); db.prepare("DELETE FROM budget_overrides WHERE category_id=? AND month>=?").run(catId, month); return true; }
  if (cents === c.budget_cents) db.prepare("DELETE FROM budget_overrides WHERE category_id=? AND month=?").run(catId, month);
  else db.prepare("INSERT INTO budget_overrides (category_id, month, amount_cents) VALUES (?,?,?) ON CONFLICT(category_id, month) DO UPDATE SET amount_cents=excluded.amount_cents").run(catId, month, cents);
  return true;
}

// ---------- rules ----------
export const listRules = () => db.prepare("SELECT r.id, r.pattern, r.category_id, c.name AS category FROM money_rules r JOIN money_categories c ON c.id=r.category_id ORDER BY length(r.pattern) DESC").all() as { id: number; pattern: string; category_id: number; category: string }[];
export function addRule(pattern: string, categoryId: number) { const p = pattern.trim().toLowerCase(); if (!p) return; db.prepare("DELETE FROM money_rules WHERE lower(pattern)=?").run(p); db.prepare("INSERT INTO money_rules (pattern, category_id) VALUES (?,?)").run(p, categoryId); }
export const deleteRule = (id: number) => db.prepare("DELETE FROM money_rules WHERE id=?").run(id).changes > 0;
export function categoryForPayee(payee: string): number | null { const p = payee.toLowerCase(); return listRules().find((r) => p.includes(r.pattern))?.category_id ?? null; }
export function applyRulesToUncategorized(): number {
  let n = 0; for (const t of db.prepare("SELECT id, payee FROM transactions WHERE category_id IS NULL").all() as { id: number; payee: string }[]) { const c = categoryForPayee(t.payee); if (c) { db.prepare("UPDATE transactions SET category_id=? WHERE id=?").run(c, t.id); n++; } }
  return n;
}

// ---------- transactions ----------
const TXSQL = "SELECT t.*, c.name AS category_name, c.color AS category_color FROM transactions t LEFT JOIN money_categories c ON c.id=t.category_id";
export function addTransaction(t: { date?: string; amount_cents: number; payee?: string; category_id?: number | null; note?: string; source?: string; sub_id?: number | null; hash?: string | null }): number | null {
  if (!Number.isFinite(t.amount_cents) || t.amount_cents === 0) throw new Error("Amount can't be zero");
  const date = t.date ?? today(); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const cat = t.category_id === undefined ? categoryForPayee(t.payee ?? "") : t.category_id;
  try { return Number(db.prepare("INSERT INTO transactions (date, amount_cents, payee, category_id, note, source, sub_id, hash) VALUES (?,?,?,?,?,?,?,?)").run(date, Math.round(t.amount_cents), (t.payee ?? "").trim(), cat, t.note ?? "", t.source ?? "manual", t.sub_id ?? null, t.hash ?? null).lastInsertRowid); }
  catch (e) { if (/UNIQUE/.test((e as Error).message)) return null; throw e; }
}
export function listTransactions(o: { month?: string; category?: number | "none"; q?: string; limit?: number } = {}): Tx[] {
  const w: string[] = ["1=1"], a: unknown[] = [];
  if (o.month) { w.push("t.date LIKE ?"); a.push(o.month + "-%"); }
  if (o.category === "none") w.push("t.category_id IS NULL"); else if (o.category) { w.push("t.category_id=?"); a.push(o.category); }
  if (o.q) { w.push("(t.payee LIKE ? OR t.note LIKE ?)"); a.push(`%${o.q}%`, `%${o.q}%`); }
  return db.prepare(`${TXSQL} WHERE ${w.join(" AND ")} ORDER BY t.date DESC, t.id DESC LIMIT ?`).all(...a, o.limit ?? 200) as Tx[];
}
export function updateTransaction(id: number, p: { category_id?: number | null; payee?: string; amount_cents?: number; date?: string; note?: string }) {
  const sets: string[] = [], a: unknown[] = []; const set = (c: string, v: unknown) => { sets.push(`${c}=?`); a.push(v); };
  if (p.category_id !== undefined) set("category_id", p.category_id); if (p.payee !== undefined) set("payee", p.payee.trim()); if (p.amount_cents !== undefined) set("amount_cents", Math.round(p.amount_cents));
  if (p.date !== undefined) set("date", p.date); if (p.note !== undefined) set("note", p.note);
  return sets.length ? db.prepare(`UPDATE transactions SET ${sets.join(",")} WHERE id=?`).run(...a, id).changes > 0 : false;
}
export const deleteTransaction = (id: number) => db.prepare("DELETE FROM transactions WHERE id=?").run(id).changes > 0;
export const txHash = (date: string, cents: number, payee: string) => crypto.createHash("sha1").update(`${date}|${cents}|${payee.toLowerCase().replace(/\s+/g, " ").trim()}`).digest("hex");
/** Import mapped CSV rows. Same date+amount+payee is treated as a duplicate (a second identical purchase on one day gets a suffix so it isn't lost). */
export function importRows(rows: { date: string; amount_cents: number; payee: string }[]): { imported: number; duplicates: number } {
  let imported = 0, duplicates = 0; const seen = new Map<string, number>();
  db.transaction(() => { for (const r of rows) {
    const base = txHash(r.date, r.amount_cents, r.payee), n = (seen.get(base) ?? 0) + 1; seen.set(base, n);
    const id = addTransaction({ ...r, source: "csv", hash: n === 1 ? base : `${base}#${n}` }); id ? imported++ : duplicates++;
  } })();
  return { imported, duplicates };
}

// ---------- summaries ----------
export function monthSummary(month: string, t = today()) {
  const cats = listCategories(), tx = db.prepare("SELECT category_id, SUM(amount_cents) s FROM transactions WHERE date LIKE ? GROUP BY category_id").all(month + "-%") as { category_id: number | null; s: number }[];
  const by = new Map(tx.map((r) => [r.category_id, r.s]));
  const rows = cats.filter((c) => c.kind === "expense").map((c) => { const budget = budgetFor(c, month), spent = -(by.get(c.id) ?? 0); return { category: c, budget, spent, pct: budget ? Math.round((spent / budget) * 100) : spent > 0 ? 999 : 0 }; });
  const incomeRows = cats.filter((c) => c.kind === "income").map((c) => ({ category: c, received: by.get(c.id) ?? 0 }));
  const uncategorized = by.get(null) ?? 0;
  const spent = rows.reduce((n, r) => n + r.spent, 0) + (uncategorized < 0 ? -uncategorized : 0);
  const income = incomeRows.reduce((n, r) => n + r.received, 0) + (uncategorized > 0 ? uncategorized : 0);
  const budgeted = rows.reduce((n, r) => n + r.budget, 0), dim = daysInMonth(month);
  const dayOfMonth = month === monthOf(t) ? Number(t.slice(8)) : month < monthOf(t) ? dim : 0;
  return { month, rows, incomeRows, uncategorized_cents: uncategorized, spent_cents: spent, income_cents: income, budgeted_cents: budgeted, remaining_cents: budgeted - spent,
    daysInMonth: dim, dayOfMonth, projected_cents: dayOfMonth > 0 && month === monthOf(t) ? Math.round((spent / dayOfMonth) * dim) : spent };
}
export function spendTrend(months = 6, t = today()) { const cur = monthOf(t); return Array.from({ length: months }, (_, i) => { const m = shiftMonth(cur, i - (months - 1)); const r = db.prepare("SELECT SUM(CASE WHEN amount_cents<0 THEN -amount_cents ELSE 0 END) sp, SUM(CASE WHEN amount_cents>0 THEN amount_cents ELSE 0 END) inc FROM transactions WHERE date LIKE ?").get(m + "-%") as { sp: number | null; inc: number | null }; return { month: m, spent: r.sp ?? 0, income: r.inc ?? 0 }; }); }
export function topPayees(month: string, limit = 5) { return db.prepare("SELECT payee, SUM(-amount_cents) total, COUNT(*) n FROM transactions WHERE date LIKE ? AND amount_cents<0 AND payee!='' GROUP BY lower(payee) ORDER BY total DESC LIMIT ?").all(month + "-%", limit) as { payee: string; total: number; n: number }[]; }
/** Categories that crossed 80% / 100% of this month's budget. */
export function budgetAlerts(month = monthOf(today())) { const out: { category: Category; pct: number; level: 80 | 100; spent: number; budget: number }[] = []; for (const r of monthSummary(month).rows) { if (r.budget <= 0) continue; if (r.pct >= 100) out.push({ category: r.category, pct: r.pct, level: 100, spent: r.spent, budget: r.budget }); else if (r.pct >= 80) out.push({ category: r.category, pct: r.pct, level: 80, spent: r.spent, budget: r.budget }); } return out; }

// ---------- savings goals ----------
export type Saving = { id: number; name: string; target_cents: number; saved_cents: number; due: string | null; color: string };
export const listSavings = () => db.prepare("SELECT * FROM savings_goals WHERE archived=0 ORDER BY id").all() as Saving[];
export function createSaving(name: string, target_cents: number, due?: string | null, color = "#1f845a") { return Number(db.prepare("INSERT INTO savings_goals (name, target_cents, due, color) VALUES (?,?,?,?)").run(name.trim(), Math.max(1, Math.round(target_cents)), due || null, color).lastInsertRowid); }
export const contributeSaving = (id: number, cents: number) => db.prepare("UPDATE savings_goals SET saved_cents=MAX(0, saved_cents+?) WHERE id=?").run(Math.round(cents), id).changes > 0;
export const archiveSaving = (id: number) => db.prepare("UPDATE savings_goals SET archived=1 WHERE id=?").run(id).changes > 0;
export function savingNeeded(s: Saving, t = today()): number | null { if (!s.due || s.due <= t) return null; const left = Math.max(0, s.target_cents - s.saved_cents); const months = Math.max(1, (Number(s.due.slice(0, 4)) - Number(t.slice(0, 4))) * 12 + Number(s.due.slice(5, 7)) - Number(t.slice(5, 7))); return Math.ceil(left / months); }
