// Pure quick-add parser + repeat helpers (no DB, safe in the browser).
import { addDays, weekday } from "./dates";

export type Parsed = {
  title: string; project?: string; due?: string | null; priority?: number; tags?: string[]; repeat?: string | null; status?: "todo" | "doing" | "done";
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

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
/** "Pay rent every month #bills @home !high tomorrow" -> structured task. `t` is today's date in the user's timezone. */
export function parseQuickAdd(input: string, t: string): Parsed {
  let s = ` ${input.trim()} `;
  const out: Parsed = { title: "" };
  const eat = (re: RegExp, fn: (m: RegExpMatchArray) => void) => { const m = s.match(re); if (m) { fn(m); s = s.replace(m[0], " "); } };

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
  if (out.due === undefined) {
    const full = new RegExp(`\\s(?:(?:on|next)\\s+)?(${DAYS.join("|")})(?=\\s)`, "i");
    const abbr = /\son\s+(sun|mon|tue|wed|thu|fri|sat)(?=\s)/i;
    const dayIdx = (w: string) => DAYS.findIndex((d) => d.startsWith(w.toLowerCase().slice(0, 3)));
    const apply = (m: RegExpMatchArray) => { out.due = addDays(t, ((dayIdx(m[1]) - weekday(t) + 6) % 7) + 1); };
    eat(full, apply);
    if (out.due === undefined) eat(abbr, apply);
  }
  out.title = s.replace(/\s+/g, " ").trim().replace(/\s+(on|by|at|due|for)$/i, "");
  return out;
}
