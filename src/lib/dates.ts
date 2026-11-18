// Pure date helpers (no DB, safe in the browser). Dates are "YYYY-MM-DD" strings.
const parse = (s: string) => new Date(s + "T00:00:00Z");
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(s: string, n: number) { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }
export function addMonths(s: string, n: number) {
  const d = parse(s), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return fmt(d);
}
export const weekday = (s: string) => parse(s).getUTCDay(); // 0 = Sunday
export const nice = (s: string) => new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(parse(s));
export const diffDays = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / 86_400_000);
