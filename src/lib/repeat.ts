// Pure repeat rules (no DB, safe in the browser). A rule is stored as a short string in tasks.repeat.
//
//   1d 2w 1m 1y weekdays     fixed steps from the due date (the original forms; unchanged)
//   on:1,3,5                 every week on these weekdays (0 = Sunday … 6 = Saturday)
//   md:15  md:-1             every month on this day (clamped to short months); -1 = the last day
//   nth:2:2  nth:-1:5        every month on the nth weekday: 2nd Tuesday, last (-1) Friday
//   wd:1  wd:-1              every month on the first / last working day (Mon–Fri)
//   qwd:1  qwd:-1            every quarter (Jan, Apr, Jul, Oct) on the first / last working day
//   after:3d after:2w        this long after you complete it, whatever the due date was
import { addDays, addMonths, weekday } from "./dates";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = DAY_NAMES.map((d) => d.slice(0, 3));
const DAY_RE = "(?:mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)";
export const DAY_LIST_RE = `${DAY_RE}s?(?:(?:\\s*(?:,|\\/|&|\\+|\\band\\b)\\s*|\\s+)${DAY_RE}s?\\b)*`;
const ORD: Record<string, number> = { first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, last: -1 };
export const ORD_RE = "(?:first|1st|second|2nd|third|3rd|fourth|4th|last)";
const UNIT: Record<string, "d" | "w" | "m"> = { d: "d", day: "d", days: "d", w: "w", week: "w", weeks: "w", m: "m", month: "m", months: "m" };
const ALIAS: Record<string, string> = {
  daily: "1d", day: "1d", weekly: "1w", week: "1w", monthly: "1m", month: "1m", fortnightly: "2w", fortnight: "2w",
  quarterly: "3m", quarter: "3m", yearly: "1y", year: "1y", annually: "1y", weekdays: "weekdays", weekday: "weekdays",
};
const dayIdx = (w: string) => SHORT.findIndex((d) => d.toLowerCase() === w.toLowerCase().slice(0, 3));
/** "mon, wed and fri" -> "on:1,3,5" (Monday to Friday is the same as "weekdays"). */
export function daysRule(list: string): string {
  const days = [...new Set(list.toLowerCase().split(/[\s,/&+]+|\band\b/).filter(Boolean).map(dayIdx))].sort();
  if (!days.length || days.some((d) => d < 0)) throw new Error(`Invalid days "${list}"`);
  return days.join(",") === "1,2,3,4,5" ? "weekdays" : `on:${days.join(",")}`;
}
const ordinal = (n: number) => (n === -1 ? "last" : `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`);

const BAD = (s: string) => new Error(`Invalid repeat "${s}". Try daily, weekdays, weekly, monthly, every 3 days, every Mon and Thu, 15th of the month, last Friday of the month, first weekday of the quarter, or 3 days after done.`);
/** Checks a stored rule is well-formed. */
function valid(r: string): boolean {
  let m: RegExpMatchArray | null;
  if (r === "weekdays") return true;
  if ((m = r.match(/^(\d+)([dwmy])$/))) return +m[1] >= 1 && +m[1] <= 365;
  if ((m = r.match(/^on:([0-6](?:,[0-6])*)$/))) return true;
  if ((m = r.match(/^md:(-1|\d{1,2})$/))) return +m[1] === -1 || (+m[1] >= 1 && +m[1] <= 31);
  if ((m = r.match(/^nth:(-1|[1-4]):([0-6])$/))) return true;
  if ((m = r.match(/^q?wd:(-1|1)$/))) return true;
  if ((m = r.match(/^after:(\d+)([dwm])$/))) return +m[1] >= 1 && +m[1] <= 365;
  return false;
}

/** What you type -> the stored rule. Throws with a helpful message when it can't tell. */
export function normalizeRepeat(s?: string | null): string | null {
  if (!s || !s.trim()) return null;
  const raw = s.trim(), x0 = raw.toLowerCase().replace(/\s+/g, " ").replace(/^repeats? /, "");
  if (valid(x0)) return x0;
  const x = x0.replace(/^every /, "").replace(/^(?:on )?the /, "");
  if (Object.hasOwn(ALIAS, x)) return ALIAS[x];
  let m: RegExpMatchArray | null;
  if ((m = x.match(/^(\d+) ?(d|w|m|y|days?|weeks?|months?|years?)$/)) && +m[1] >= 1 && +m[1] <= 365) return `${+m[1]}${m[2][0]}`;
  if ((m = x.match(/^(?:other|2nd|second) (day|week|month|year)$/))) return `2${m[1][0]}`;
  // N days/weeks/months after done
  if ((m = x.match(/^(?:(\d+|a|an|one) )?(d|days?|w|weeks?|m|months?) after (?:it'?s |i )?(?:done|completed?|completion|complete it|finish(?:ed|ing)?(?: it)?)$/)) || (m = x.match(/^after (\d+|a|an|one) (days?|weeks?|months?)$/))) {
    const n = m[1] && /^\d+$/.test(m[1]) ? +m[1] : 1; if (n >= 1 && n <= 365) return `after:${n}${UNIT[m[2]]}`;
  }
  // every Mon, Wed and Fri
  if ((m = x.match(new RegExp(`^(?:on )?(${DAY_LIST_RE})$`)))) return daysRule(m[1]);
  // Mon-Fri, mon to thu
  if ((m = x.match(new RegExp(`^(${DAY_RE}) ?(?:-|to|through|thru) ?(${DAY_RE})$`)))) { const a = dayIdx(m[1]), b = dayIdx(m[2]), d: string[] = []; for (let i = a; ; i = (i + 1) % 7) { d.push(SHORT[i]); if (i === b) break; } return daysRule(d.join(",")); }
  // last Friday of the month / 2nd Tuesday
  if ((m = x.match(new RegExp(`^(${ORD_RE}) (${DAY_RE})(?: of (?:the |each |every )?month)?$`)))) return `nth:${ORD[m[1]]}:${dayIdx(m[2])}`;
  // first / last weekday of the month or quarter
  if ((m = x.match(new RegExp(`^(first|1st|last) (?:week|work(?:ing)?|business) ?day(?: of (?:the |each |every )?(month|quarter))?$`)))) return `${m[2] === "quarter" ? "q" : ""}wd:${ORD[m[1]]}`;
  // 15th of the month, monthly on the 15th, last day of the month
  if ((m = x.match(/^(?:monthly on (?:the )?)?(\d{1,2})(?:st|nd|rd|th)?(?: (?:day )?of (?:the |each |every )?month)?$/)) && +m[1] >= 1 && +m[1] <= 31 && (x.includes("month") || /\d(st|nd|rd|th)$/.test(x))) return `md:${+m[1]}`;
  if (/^(?:monthly on (?:the )?)?last day(?: of (?:the |each |every )?month)?$/.test(x)) return "md:-1";
  throw BAD(raw);
}

/** The rule in words, lowercase ("every Mon and Thu", "last Friday of the month"). */
export function describeRepeat(r: string): string {
  let m: RegExpMatchArray | null;
  if (r === "weekdays") return "weekdays";
  if ((m = r.match(/^on:(.+)$/))) { const d = m[1].split(",").map((n) => +n); if (d.length === 1) return `every ${DAY_NAMES[d[0]]}`; const n = d.map((i) => SHORT[i]); return `every ${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`; }
  if ((m = r.match(/^md:(-?\d+)$/))) return +m[1] === -1 ? "last day of the month" : `${ordinal(+m[1])} of the month`;
  if ((m = r.match(/^nth:(-?\d):(\d)$/))) return `${ordinal(+m[1])} ${DAY_NAMES[+m[2]]} of the month`;
  if ((m = r.match(/^(q?)wd:(-?1)$/))) return `${m[2] === "1" ? "first" : "last"} weekday of the ${m[1] ? "quarter" : "month"}`;
  if ((m = r.match(/^after:(\d+)([dwm])$/))) { const n = +m[1], u = { d: "day", w: "week", m: "month" }[m[2] as "d"]; return `${n} ${u}${n === 1 ? "" : "s"} after done`; }
  const n = parseInt(r), u = r.slice(-1) as "d" | "w" | "m" | "y";
  return n === 1 ? { d: "daily", w: "weekly", m: "monthly", y: "yearly" }[u] : `every ${n} ${{ d: "day", w: "week", m: "month", y: "year" }[u]}s`;
}
/** How a repeat reads in the app: sentence case, like the rest of the text ("Weekly", "Every 2 weeks"). The API keeps the stored form. */
export const repeatLabel = (r: string) => { const d = describeRepeat(r); return d.charAt(0).toUpperCase() + d.slice(1); };

// ---------- next dates ----------
const lastOfMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
const ymd = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);
const isWork = (s: string) => ![0, 6].includes(weekday(s));
/** The date this rule lands on in a given month (m0 = 0-based month), or null if it doesn't land in that month. */
function inMonth(r: string, y: number, m0: number): string | null {
  let m: RegExpMatchArray | null;
  const last = lastOfMonth(y, m0);
  if ((m = r.match(/^md:(-?\d+)$/))) return ymd(y, m0, +m[1] === -1 ? last : Math.min(+m[1], last));
  if ((m = r.match(/^nth:(-?\d):(\d)$/))) {
    const n = +m[1], dow = +m[2];
    if (n === -1) { let d = last; while (weekday(ymd(y, m0, d)) !== dow) d--; return ymd(y, m0, d); }
    let d = 1; while (weekday(ymd(y, m0, d)) !== dow) d++; d += 7 * (n - 1); return d <= last ? ymd(y, m0, d) : null;
  }
  if ((m = r.match(/^(q?)wd:(-?1)$/))) {
    if (m[1] && m0 % 3 !== (m[2] === "1" ? 0 : 2)) return null; // quarters start in Jan/Apr/Jul/Oct and end in Mar/Jun/Sep/Dec
    if (m[2] === "1") { let d = 1; while (!isWork(ymd(y, m0, d))) d++; return ymd(y, m0, d); }
    let d = last; while (!isWork(ymd(y, m0, d))) d--; return ymd(y, m0, d);
  }
  return null;
}
/** True for rules tied to the calendar (a weekday, a day of the month) rather than a step from the last date. */
export const isCalendarRule = (r: string) => /^(on|md|nth|q?wd):/.test(r);
/** The first date strictly after `d` that a calendar rule lands on. */
export function nextOnRule(d: string, r: string): string {
  const on = r.match(/^on:(.+)$/);
  if (on) { const days = on[1].split(",").map(Number); let n = addDays(d, 1); while (!days.includes(weekday(n))) n = addDays(n, 1); return n; }
  let y = +d.slice(0, 4), m0 = +d.slice(5, 7) - 1;
  for (let i = 0; i < 40; i++) { const c = inMonth(r, y, m0); if (c && c > d) return c; m0++; if (m0 === 12) { m0 = 0; y++; } }
  throw new Error(`Repeat "${r}" has no next date`);
}
/** One fixed step from `d` (the original rules). */
function step(d: string, r: string): string {
  if (r === "weekdays") { let n = addDays(d, 1); while (!isWork(n)) n = addDays(n, 1); return n; }
  const n = parseInt(r), u = r.slice(-1);
  return u === "d" ? addDays(d, n) : u === "w" ? addDays(d, 7 * n) : u === "m" ? addMonths(d, n) : addMonths(d, 12 * n);
}
const after = (d: string, r: string) => { const m = r.match(/^after:(\d+)([dwm])$/)!; const n = +m[1]; return m[2] === "d" ? addDays(d, n) : m[2] === "w" ? addDays(d, 7 * n) : addMonths(d, n); };
/**
 * The next due date after completing a task on `t` (today). Always strictly after today, so overdue repeats skip forward without piling up.
 * "after:" rules count from today, whatever the old due date was.
 */
export function nextRepeatDue(due: string | null, r: string, t: string): string {
  if (r.startsWith("after:")) return after(t, r);
  if (isCalendarRule(r)) return nextOnRule(due && due > t ? due : t, r);
  let d = due ?? t;
  do { d = step(d, r); } while (d <= t);
  return d;
}
/** The first due date for a new repeating task with no date of its own: today, or the first day on/after today the rule lands on. */
export const firstRepeatDue = (r: string, t: string) => (isCalendarRule(r) ? nextOnRule(addDays(t, -1), r) : t);
