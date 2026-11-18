// Pure quick-add parser + repeat helpers (no DB, safe in the browser).
import { addDays, addMonths, weekday } from "./dates";

export type Parsed = {
  title: string; project?: string; due?: string | null; due_time?: string | null; estimate?: number | null; priority?: number; tags?: string[]; repeat?: string | null; status?: "todo" | "doing" | "done";
};

const ALIAS: Record<string, string> = {
  daily: "1d", day: "1d", weekly: "1w", week: "1w", monthly: "1m", month: "1m",
  yearly: "1y", year: "1y", annually: "1y", weekdays: "weekdays", weekday: "weekdays",
};
export function normalizeRepeat(s?: string | null): string | null {
  if (!s || !s.trim()) return null;
  const x = s.trim().toLowerCase();
  if (Object.hasOwn(ALIAS, x)) return ALIAS[x];
  const m = x.match(/^(?:every\s+)?(\d+)\s*(d|w|m|y|days?|weeks?|months?|years?)$/);
  if (m && +m[1] >= 1 && +m[1] <= 365) return `${+m[1]}${m[2][0]}`;
  throw new Error(`Invalid repeat "${s}". Use daily, weekdays, weekly, monthly, yearly, or e.g. "every 3 days".`);
}
export function describeRepeat(r: string): string {
  if (r === "weekdays") return "weekdays";
  const n = parseInt(r), u = r.slice(-1) as "d" | "w" | "m" | "y";
  return n === 1 ? { d: "daily", w: "weekly", m: "monthly", y: "yearly" }[u] : `every ${n} ${{ d: "day", w: "week", m: "month", y: "year" }[u]}s`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
/** "31 march" / "march 31st" / "mar 31 2027" -> YYYY-MM-DD. Without a year it is the next occurrence (this year, or next if already past). */
function monthDay(day: number, month: string, year: string | undefined, today: string): string | undefined {
  const mi = MONTHS.indexOf(month.toLowerCase().slice(0, 3)); if (mi < 0 || day < 1 || day > 31) return;
  const mk = (y: number) => { const d = new Date(Date.UTC(y, mi, day)); return d.getUTCMonth() === mi ? d.toISOString().slice(0, 10) : undefined; }; // rejects 31 Feb
  if (year) return mk(+year);
  const y = +today.slice(0, 4), c = mk(y);
  return c && c >= today ? c : mk(y + 1);
}
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
/** "Pay rent every month #bills @home !high tomorrow" -> structured task. `t` is today's date in the user's timezone. */
export function parseQuickAdd(input: string, t: string): Parsed {
  let s = ` ${input.trim()} `;
  const out: Parsed = { title: "" };
  const eat = (re: RegExp, fn: (m: RegExpMatchArray) => void) => { const m = s.match(re); if (m) { fn(m); s = s.replace(m[0], " "); } };
  const eatIf = (re: RegExp, fn: (m: RegExpMatchArray) => boolean) => { const m = s.match(re); if (m && fn(m)) s = s.replace(m[0], " "); }; // only consume text when it really was a valid value

  const tags: string[] = [];
  s = s.replace(/\s#([\p{L}\p{N}_-]+)(?=\s)/gu, (_, g) => { tags.push(g); return " "; });
  if (tags.length) out.tags = tags;
  eat(/\s@([\p{L}\p{N}_-]+)(?=\s)/u, (m) => (out.project = m[1]));
  eat(/\s!(high|h|!)(?=\s)/i, () => (out.priority = 1));
  eat(/\s!(low|l)(?=\s)/i, () => (out.priority = -1));
  eat(/\s!(doing)(?=\s)/i, () => (out.status = "doing"));
  eat(/\s(?:every\s+(\d+\s*(?:d|w|m|y|days?|weeks?|months?|years?)|day|week|weekday|weekdays|month|year)|(daily|weekly|monthly|yearly|weekdays))(?=\s)/i,
    (m) => (out.repeat = normalizeRepeat(m[1] ?? m[2])));
  eat(/\s(\d{4}-\d{2}-\d{2})(?=\s)/, (m) => (out.due = m[1]));
  if (out.due === undefined) eat(/\s(today|tonight)(?=\s)/i, () => (out.due = t));
  if (out.due === undefined) eat(/\s(tomorrow|tmrw)(?=\s)/i, () => (out.due = addDays(t, 1)));
  if (out.due === undefined) eat(/\sin\s+(\d+)\s+(day|week)s?(?=\s)/i, (m) => (out.due = addDays(t, +m[1] * (m[2].toLowerCase() === "week" ? 7 : 1))));
  if (out.due === undefined) eatIf(new RegExp(`\\s(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}(?:\\s+(\\d{4}))?(?=\\s)`, "i"), (m) => { const d = monthDay(+m[1], m[2], m[3], t); if (d) out.due = d; return !!d; });
  if (out.due === undefined) eatIf(new RegExp(`\\s${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?(?=\\s)`, "i"), (m) => { const d = monthDay(+m[2], m[1], m[3], t); if (d) out.due = d; return !!d; });
  if (out.due === undefined) eat(/\snext\s+week(?=\s)/i, () => (out.due = addDays(t, ((1 - weekday(t) + 7) % 7) || 7)));
  if (out.due === undefined) eat(/\snext\s+month(?=\s)/i, () => (out.due = addMonths(t, 1)));
  if (out.due === undefined) {
    const full = new RegExp(`\\s(?:(?:on|next)\\s+)?(${DAYS.join("|")})(?=\\s)`, "i");
    const abbr = /\son\s+(sun|mon|tue|wed|thu|fri|sat)(?=\s)/i;
    const dayIdx = (w: string) => DAYS.findIndex((d) => d.startsWith(w.toLowerCase().slice(0, 3)));
    const apply = (m: RegExpMatchArray) => { out.due = addDays(t, ((dayIdx(m[1]) - weekday(t) + 6) % 7) + 1); };
    eat(full, apply);
    if (out.due === undefined) eat(abbr, apply);
  }
  // time of day: "at 5pm", "5:30pm", "at 17:30", "17:30", "at noon"
  const pad = (n: number) => String(n).padStart(2, "0");
  const ampm = s.match(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s)/i);
  if (ampm && +ampm[1] >= 1 && +ampm[1] <= 12 && +(ampm[2] ?? 0) < 60) { out.due_time = `${pad((+ampm[1] % 12) + (ampm[3].toLowerCase() === "pm" ? 12 : 0))}:${ampm[2] ?? "00"}`; s = s.replace(ampm[0], " "); }
  if (!out.due_time) { const h24 = s.match(/\s(?:at\s+)?(\d{1,2}):(\d{2})(?=\s)/i); if (h24 && +h24[1] < 24 && +h24[2] < 60) { out.due_time = `${pad(+h24[1])}:${h24[2]}`; s = s.replace(h24[0], " "); } }
  if (!out.due_time) eat(/\sat\s+(noon|midday)(?=\s)/i, () => (out.due_time = "12:00"));
  // estimate: "~30m", "~1.5h", "~45"
  eat(/\s~(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)?(?=\s)/i, (m) => { const n = parseFloat(m[1]); out.estimate = Math.max(1, Math.round((m[2] ?? "m")[0].toLowerCase() === "h" ? n * 60 : n)); });
  out.title = s.replace(/\s+/g, " ").trim().replace(/\s+(on|by|at|due|for)$/i, "");
  return out;
}
