import { db } from "./db";
import { addDays, addMonths, diffDays } from "./dates";
import { addTransaction, createCategory, getCategory } from "./money";
import { today } from "./time";

export type Cycle = "weekly" | "fortnightly" | "monthly" | "quarterly" | "halfyearly" | "yearly";
export type Sub = { id: number; name: string; amount_cents: number; cycle: Cycle; next_due: string; category_id: number | null; url: string; notes: string; trial_ends: string | null; status: "active" | "paused" | "cancelled"; remind_days: number; auto_log: number; color: string; started: string | null; cancelled_at: string | null };
export const CYCLES: Cycle[] = ["weekly", "fortnightly", "monthly", "quarterly", "halfyearly", "yearly"];
export const CYCLE_LABEL: Record<Cycle, string> = { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", quarterly: "Quarterly", halfyearly: "Half-yearly", yearly: "Yearly" };
export const CYCLE_SHORT: Record<Cycle, string> = { weekly: "wk", fortnightly: "fortnight", monthly: "mo", quarterly: "qtr", halfyearly: "6 mo", yearly: "yr" };
export const stepDate = (d: string, c: Cycle) => (c === "weekly" ? addDays(d, 7) : c === "fortnightly" ? addDays(d, 14) : c === "monthly" ? addMonths(d, 1) : c === "quarterly" ? addMonths(d, 3) : c === "halfyearly" ? addMonths(d, 6) : addMonths(d, 12));
export const stepBack = (d: string, c: Cycle) => (c === "weekly" ? addDays(d, -7) : c === "fortnightly" ? addDays(d, -14) : c === "monthly" ? addMonths(d, -1) : c === "quarterly" ? addMonths(d, -3) : c === "halfyearly" ? addMonths(d, -6) : addMonths(d, -12));
/** Average cost per month (weekly = 52/12 per month, yearly = 1/12). */
export const monthlyCents = (s: { amount_cents: number; cycle: Cycle }) => Math.round(s.amount_cents * ({ weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1, quarterly: 1 / 3, halfyearly: 1 / 6, yearly: 1 / 12 }[s.cycle]));
export const yearlyCents = (s: { amount_cents: number; cycle: Cycle }) => monthlyCents(s) * 12;

export const listSubs = (status?: Sub["status"]): Sub[] => db.prepare(`SELECT * FROM subscriptions ${status ? "WHERE status=?" : ""} ORDER BY status='cancelled', next_due, name`).all(...(status ? [status] : [])) as Sub[];
export const getSub = (id: number) => db.prepare("SELECT * FROM subscriptions WHERE id=?").get(id) as Sub | undefined;
export function createSub(s: { name: string; amount_cents: number; cycle?: Cycle; next_due?: string; category_id?: number | null; url?: string; notes?: string; trial_ends?: string | null; remind_days?: number; auto_log?: boolean; color?: string }): number {
  if (!s.name.trim()) throw new Error("Name is required"); if (!(s.amount_cents >= 0)) throw new Error("Amount must be zero or more");
  const cycle = s.cycle ?? "monthly"; if (!CYCLES.includes(cycle)) throw new Error("Invalid billing cycle");
  const next = s.next_due ?? (s.trial_ends ?? stepDate(today(), cycle));
  const id = Number(db.prepare("INSERT INTO subscriptions (name, amount_cents, cycle, next_due, category_id, url, notes, trial_ends, remind_days, auto_log, color, started) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(s.name.trim(), Math.round(s.amount_cents), cycle, next, s.category_id ?? null, s.url ?? "", s.notes ?? "", s.trial_ends ?? null, s.remind_days ?? 3, s.auto_log === false ? 0 : 1, s.color ?? "#1877f2", today()).lastInsertRowid);
  db.prepare("INSERT INTO sub_price_history (sub_id, amount_cents, from_date) VALUES (?,?,?)").run(id, Math.round(s.amount_cents), today());
  return id;
}
export function updateSub(id: number, p: Partial<Pick<Sub, "name" | "amount_cents" | "cycle" | "next_due" | "category_id" | "url" | "notes" | "trial_ends" | "remind_days" | "auto_log" | "color">>): boolean {
  const cur = getSub(id); if (!cur) return false;
  const sets: string[] = [], a: unknown[] = []; for (const [k, v] of Object.entries(p)) { if (v === undefined) continue; sets.push(`${k}=?`); a.push(v); }
  if (sets.length) db.prepare(`UPDATE subscriptions SET ${sets.join(",")} WHERE id=?`).run(...a, id);
  if (p.amount_cents !== undefined && p.amount_cents !== cur.amount_cents) db.prepare("INSERT INTO sub_price_history (sub_id, amount_cents, from_date) VALUES (?,?,?)").run(id, p.amount_cents, today());
  return true;
}
export const setSubStatus = (id: number, status: Sub["status"]) => db.prepare("UPDATE subscriptions SET status=?, cancelled_at=? WHERE id=?").run(status, status === "cancelled" ? today() : null, id).changes > 0;
export const priceHistory = (id: number) => db.prepare("SELECT amount_cents, from_date FROM sub_price_history WHERE sub_id=? ORDER BY from_date, id").all(id) as { amount_cents: number; from_date: string }[];
/** Price change vs. the first recorded price, e.g. { from: 1299, to: 1499 } */
export function priceChange(id: number): { from: number; to: number } | null { const h = priceHistory(id); return h.length > 1 && h[0].amount_cents !== h[h.length - 1].amount_cents ? { from: h[0].amount_cents, to: h[h.length - 1].amount_cents } : null; }

export function subsSummary(t = today()) {
  const act = listSubs("active");
  const monthly = act.reduce((n, s) => n + monthlyCents(s), 0);
  const next = act.filter((s) => s.next_due >= t).sort((a, b) => a.next_due.localeCompare(b.next_due))[0] ?? null;
  const dueSoon = act.filter((s) => s.next_due >= t && diffDays(s.next_due, t) <= 7);
  const trials = act.filter((s) => s.trial_ends && s.trial_ends >= t && diffDays(s.trial_ends, t) <= 7);
  const thisMonth = act.filter((s) => s.next_due.slice(0, 7) === t.slice(0, 7) && s.next_due >= t).reduce((n, s) => n + s.amount_cents, 0);
  return { active: act.length, monthly_cents: monthly, yearly_cents: monthly * 12, next, dueSoon, trials, remaining_this_month_cents: thisMonth, paused: listSubs("paused").length, cancelled: listSubs("cancelled") };
}
/** Materialise payments that have come due: log a transaction (when auto-log is on) and roll the date forward. Safe to call repeatedly. */
export function advanceSubscriptions(t = today()): number {
  let n = 0;
  for (const s of listSubs("active")) {
    let d = s.next_due, guard = 0;
    while (d <= t && guard++ < 24) {
      if (s.auto_log) {
        const cat = s.category_id && getCategory(s.category_id) ? s.category_id : createCategory("Subscriptions", { color: "#64748b" });
        if (addTransaction({ date: d, amount_cents: -s.amount_cents, payee: s.name, category_id: cat, source: "subscription", sub_id: s.id, hash: `sub:${s.id}:${d}` })) n++;
      }
      d = stepDate(d, s.cycle);
    }
    if (d !== s.next_due) db.prepare("UPDATE subscriptions SET next_due=?, trial_ends=CASE WHEN trial_ends<=? THEN NULL ELSE trial_ends END WHERE id=?").run(d, t, s.id);
  }
  return n;
}
/** Manual "mark paid": log this payment (if auto-log is off) and move to the next cycle. */
export function markPaid(id: number): boolean { const s = getSub(id); if (!s) return false; const cat = s.category_id ?? createCategory("Subscriptions", { color: "#64748b" }); addTransaction({ date: today(), amount_cents: -s.amount_cents, payee: s.name, category_id: cat, source: "subscription", sub_id: s.id, hash: `sub:${s.id}:${s.next_due}` }); db.prepare("UPDATE subscriptions SET next_due=? WHERE id=?").run(stepDate(s.next_due, s.cycle), id); return true; }
/** Renewal / trial reminders to send today. */
export function subReminders(t = today()): { key: string; title: string; body: string }[] {
  const out: { key: string; title: string; body: string }[] = [];
  for (const s of listSubs("active")) {
    const d = diffDays(s.next_due, t);
    if (s.trial_ends && diffDays(s.trial_ends, t) >= 0 && diffDays(s.trial_ends, t) <= 2) out.push({ key: `trial:${s.id}:${s.trial_ends}`, title: `${s.name} trial ends ${diffDays(s.trial_ends, t) === 0 ? "today" : diffDays(s.trial_ends, t) === 1 ? "tomorrow" : `in ${diffDays(s.trial_ends, t)} days`}`, body: "Cancel now if you don't want to be charged." });
    else if (!s.trial_ends && d >= 0 && d <= s.remind_days) out.push({ key: `renew:${s.id}:${s.next_due}`, title: `${s.name} renews ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}`, body: `${(s.amount_cents / 100).toFixed(2)} ${s.cycle}` });
  }
  return out;
}

// ---------- pay run: tick off the charges you've paid, per week, fortnight, month or year ----------
export type Period = "week" | "fortnight" | "month" | "year";
export const PERIODS: { k: Period; label: string }[] = [{ k: "week", label: "Week" }, { k: "fortnight", label: "Fortnight" }, { k: "month", label: "Month" }, { k: "year", label: "Year" }];
/** The date range for a period containing `anchor` (weeks start on Monday). */
export function periodRange(period: Period, anchor: string): { from: string; to: string } {
  if (period === "week") { const wd = (new Date(anchor + "T00:00:00Z").getUTCDay() + 6) % 7, from = addDays(anchor, -wd); return { from, to: addDays(from, 6) }; }
  if (period === "fortnight") return { from: anchor, to: addDays(anchor, 13) };
  if (period === "month") { const from = anchor.slice(0, 8) + "01"; return { from, to: addDays(addMonths(from, 1), -1) }; }
  const y = anchor.slice(0, 4); return { from: `${y}-01-01`, to: `${y}-12-31` };
}
/** Move the anchor to the previous/next period. */
export const shiftPeriod = (period: Period, anchor: string, dir: 1 | -1) => (period === "week" ? addDays(anchor, 7 * dir) : period === "fortnight" ? addDays(anchor, 14 * dir) : period === "month" ? addMonths(anchor.slice(0, 8) + "01", dir) : addMonths(anchor, 12 * dir));
export type Charge = { sub_id: number; name: string; color: string; amount_cents: number; due: string; paid: boolean; paid_at: string | null };
/** Every charge of an active subscription that falls in [from, to], oldest first, with whether you've ticked it as paid. */
export function chargesBetween(from: string, to: string): Charge[] {
  const paid = new Map((db.prepare("SELECT sub_id, due_date, paid_at FROM sub_paid WHERE due_date BETWEEN ? AND ?").all(from, to) as { sub_id: number; due_date: string; paid_at: string }[]).map((r) => [`${r.sub_id}:${r.due_date}`, r.paid_at]));
  const out: Charge[] = [];
  for (const s of listSubs("active")) {
    const started = s.started ?? "";
    let d = s.next_due, g = 0;
    while (d > from && g++ < 800) d = stepBack(d, s.cycle);          // walk back to the first charge on or before the window...
    for (g = 0; d <= to && g < 800; g++, d = stepDate(d, s.cycle)) { // ...then forward through it
      if (d < from || (d < started && d < s.next_due)) continue;      // before the window, or before you added it
      const at = paid.get(`${s.id}:${d}`) ?? null; out.push({ sub_id: s.id, name: s.name, color: s.color, amount_cents: s.amount_cents, due: d, paid: !!at, paid_at: at });
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
}
export function setCharge(subId: number, due: string, paid: boolean): void {
  if (!getSub(subId) || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return;
  if (paid) db.prepare("INSERT OR IGNORE INTO sub_paid (sub_id, due_date) VALUES (?,?)").run(subId, due); else db.prepare("DELETE FROM sub_paid WHERE sub_id=? AND due_date=?").run(subId, due);
}
/** Tick everything still unpaid in the range. Returns how many were ticked. */
export function markRangePaid(from: string, to: string): number { let n = 0; for (const c of chargesBetween(from, to)) if (!c.paid) { setCharge(c.sub_id, c.due, true); n++; } return n; }
