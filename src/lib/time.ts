import { getSetting } from "./settings";

export function tz(): string {
  const t = getSetting("timezone") || process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  try { new Intl.DateTimeFormat("en-CA", { timeZone: t }); return t; } catch { return "UTC"; }
}
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz(), year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const today = () => ymd(new Date());
/** Convert SQLite's UTC "YYYY-MM-DD HH:MM:SS" into a date in the user's timezone. */
export const localDate = (utc: string) => ymd(new Date(utc.replace(" ", "T") + "Z"));

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
