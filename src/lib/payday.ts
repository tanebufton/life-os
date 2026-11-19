import { addDays, addMonths, diffDays } from "./dates";
import { db } from "./db";
import { getSetting, setSetting } from "./settings";
import { listSubs, type Cycle } from "./subs";
import { today } from "./time";

export type PayFreq = "weekly" | "fortnightly" | "monthly";
export const PAY_FREQS: { k: PayFreq; label: string }[] = [{ k: "weekly", label: "Every week" }, { k: "fortnightly", label: "Every fortnight" }, { k: "monthly", label: "Every month" }];
export const PAYS_PER_YEAR: Record<PayFreq, number> = { weekly: 52, fortnightly: 26, monthly: 12 };
const PER_YEAR: Record<Cycle, number> = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, halfyearly: 2, yearly: 1 };

export const paydayConfig = (): { freq: PayFreq; anchor: string } | null => {
  const f = getSetting("payday_freq") as PayFreq | null, a = getSetting("payday_anchor");
  return f && PAYS_PER_YEAR[f] && a && /^\d{4}-\d{2}-\d{2}$/.test(a) ? { freq: f, anchor: a } : null;
};
export function savePayday(freq: string, anchor: string): void {
  if (!(freq in PAYS_PER_YEAR)) throw new Error("Pick how often you're paid");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) throw new Error("Pick a recent payday");
  setSetting("payday_freq", freq); setSetting("payday_anchor", anchor);
}
/** The pay period containing `date`: from a payday up to the day before the next one. */
export function payPeriod(c: { freq: PayFreq; anchor: string }, date = today()): { from: string; to: string } {
  if (c.freq === "monthly") {
    let from = c.anchor, g = 0;
    const back = diffDays(date, c.anchor) < 0;
    if (back) { while (from > date && g++ < 1200) from = addMonths(c.anchor, -(g)); } else { let n = 0; while (addMonths(c.anchor, n + 1) <= date && g++ < 1200) n++; from = addMonths(c.anchor, n); }
    const n2 = monthsBetween(c.anchor, from); return { from, to: addDays(addMonths(c.anchor, n2 + 1), -1) };
  }
  const step = c.freq === "weekly" ? 7 : 14, k = Math.floor(diffDays(date, c.anchor) / step), from = addDays(c.anchor, k * step);
  return { from, to: addDays(from, step - 1) };
}
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
/** The pay period before (-1) or after (+1) the one starting at `from`. */
export function shiftPay(c: { freq: PayFreq; anchor: string }, from: string, dir: 1 | -1): string {
  return c.freq === "monthly" ? addMonths(c.anchor, monthsBetween(c.anchor, from) + dir) : addDays(from, dir * (c.freq === "weekly" ? 7 : 14));
}
/** What each subscription costs per pay: its yearly cost shared across the pays in a year. */
export function setAside(freq: PayFreq): { total_cents: number; items: { id: number; name: string; color: string; cycle: Cycle; amount_cents: number; per_pay_cents: number }[] } {
  const items = listSubs("active").map((s) => ({ id: s.id, name: s.name, color: s.color, cycle: s.cycle, amount_cents: s.amount_cents, per_pay_cents: Math.round((s.amount_cents * PER_YEAR[s.cycle]) / PAYS_PER_YEAR[freq]) })).sort((a, b) => b.per_pay_cents - a.per_pay_cents);
  return { total_cents: items.reduce((n, i) => n + i.per_pay_cents, 0), items };
}
export const isSetAside = (from: string) => !!db.prepare("SELECT 1 FROM payday_setaside WHERE period_start=?").get(from);
export function setSetAside(from: string, done: boolean): void { if (done) db.prepare("INSERT OR IGNORE INTO payday_setaside (period_start) VALUES (?)").run(from); else db.prepare("DELETE FROM payday_setaside WHERE period_start=?").run(from); }
