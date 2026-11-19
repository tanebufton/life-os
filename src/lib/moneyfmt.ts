// Pure money formatting + quick-add parsing (safe in the browser).
export function fmtMoney(cents: number, currency = "USD", o: { sign?: boolean; compact?: boolean } = {}): string {
  const abs = Math.abs(cents), whole = abs % 100 === 0;
  const s = new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: whole && o.compact ? 0 : 2, maximumFractionDigits: whole && o.compact ? 0 : 2 }).format(abs / 100);
  return cents < 0 ? `−${s}` : o.sign && cents > 0 ? `+${s}` : s;
}
export const toCents = (n: number) => Math.round(n * 100);

export type MoneyQuick = { amount_cents: number; payee: string; category?: string; date?: string };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/**
 * "$12.50 flat white @eating-out" / "spent 12.5 coffee #food" / "+$2000 salary" / "paid $80 power yesterday".
 * Expense by default; a leading + (or "got/received") makes it income. Returns null if it isn't a money entry.
 */
export function parseMoneyQuick(input: string, today: string, categories: string[] = []): MoneyQuick | null {
  let s = ` ${input.trim()} `, m: RegExpMatchArray | null;
  const lead = s.match(/^\s+(?:(spent|paid|bought)\s+|(got|received|earned)\s+)?(\+)?[$€£]?\s?(\d[\d,]*(?:\.\d{1,2})?)(?=\s)/i);
  const hasSymbol = /^\s+(?:\+)?[$€£]/.test(s);
  if (!lead || !(hasSymbol || lead[1] || lead[2])) return null;
  const amount = Math.round(parseFloat(lead[4].replace(/,/g, "")) * 100); if (!(amount > 0)) return null;
  const income = !!(lead[2] || lead[3]);
  s = s.replace(lead[0], " ");
  let category: string | undefined, date: string | undefined;
  if ((m = s.match(/\s[@#]([\p{L}\p{N}_-]+)(?=\s)/u))) { const want = norm(m[1]); category = categories.find((c) => norm(c) === want) ?? categories.find((c) => norm(c).startsWith(want)) ?? m[1]; s = s.replace(m[0], " "); }
  if ((m = s.match(/\s(\d{4}-\d{2}-\d{2})(?=\s)/))) { date = m[1]; s = s.replace(m[0], " "); }
  else if ((m = s.match(/\s(yesterday|today)(?=\s)/i))) { date = m[1].toLowerCase() === "yesterday" ? addDay(today, -1) : today; s = s.replace(m[0], " "); }
  const payee = s.replace(/\s+/g, " ").trim().replace(/^(at|on|for|from)\s+/i, "");
  return { amount_cents: income ? amount : -amount, payee, category, date };
}
function addDay(d: string, n: number) { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
