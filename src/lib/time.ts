import { getSetting } from "./settings";

export function tz(): string {
  const t = getSetting("timezone") || process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  try { new Intl.DateTimeFormat("en-CA", { timeZone: t }); return t; } catch { return "UTC"; }
}
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz(), year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const today = () => ymd(new Date());
/** Convert SQLite's UTC "YYYY-MM-DD HH:MM:SS" into a date in the user's timezone. */
export const localDate = (utc: string) => ymd(new Date(utc.replace(" ", "T") + "Z"));

export { addDays, addMonths, weekday, nice, diffDays } from "./dates";
