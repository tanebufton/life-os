// Pure quick-add parser + repeat helpers (no DB, safe in the browser).
import { addDays, addMonths, weekday } from "./dates";
import { DAY_LIST_RE, ORD_RE, daysRule, normalizeRepeat } from "./repeat";

export type Parsed = {
  title: string; project?: string; due?: string | null; due_time?: string | null; estimate?: number | null; priority?: number; tags?: string[]; repeat?: string | null; status?: "todo" | "doing" | "done";
  start_date?: string | null; focus?: boolean; reminders?: ReminderSpec[];
};

export { describeRepeat, normalizeRepeat, repeatLabel } from "./repeat";
/** A reminder typed in quick add ("remind me tomorrow at 4pm", "remind me 30m before"). Resolved against the task's date when it is saved. */
export type ReminderSpec = { date?: string; time?: string; before?: number };
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
/** One date word for start: and remind me: today, tomorrow, a weekday (the next one), next week/month, "in 3 days", 3d, 2w, or YYYY-MM-DD. */
export function dateWord(w: string, t: string): string | undefined {
  const x = w.trim().toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ");
  let m: RegExpMatchArray | null;
  if (/^\d{4} \d{2} \d{2}$/.test(x)) return x.replace(/ /g, "-");
  if (x === "today" || x === "tonight") return t;
  if (x === "tomorrow" || x === "tmrw") return addDays(t, 1);
  if (x === "next week" || x === "nextweek") return addDays(t, ((1 - weekday(t) + 7) % 7) || 7);
  if (x === "next month" || x === "nextmonth") return addMonths(t, 1);
  if (x === "weekend") return addDays(t, ((6 - weekday(t) + 7) % 7) || 7);
  if ((m = x.match(/^(?:in )?(\d+) ?(d|days?|w|weeks?|m|months?)$/))) return m[2][0] === "m" ? addMonths(t, +m[1]) : addDays(t, +m[1] * (m[2][0] === "w" ? 7 : 1));
  const i = DAYS.findIndex((d) => x.length >= 3 && d.startsWith(x.replace(/^(?:on|next) /, "")));
  if (i >= 0) return addDays(t, ((i - weekday(t) + 6) % 7) + 1);
}
const DATE_WORD_RE = "(?:today|tonight|tomorrow|tmrw|next\\s+week|next\\s+month|weekend|in\\s+\\d+\\s*(?:days?|weeks?|months?)|\\d{4}-\\d{2}-\\d{2}|(?:on\\s+|next\\s+)?(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)";
const TIME_RE = "(?:\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)|\\d{1,2}:\\d{2}|noon|midday)";
/** "4pm" / "16:30" / "noon" -> "HH:MM" (undefined if it isn't a real time). */
export function timeWord(w: string): string | undefined {
  const x = w.trim().toLowerCase(), pad = (n: number) => String(n).padStart(2, "0");
  if (x === "noon" || x === "midday") return "12:00";
  let m = x.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m && +m[1] >= 1 && +m[1] <= 12 && +(m[2] ?? 0) < 60) return `${pad((+m[1] % 12) + (m[3] === "pm" ? 12 : 0))}:${m[2] ?? "00"}`;
  m = x.match(/^(\d{1,2}):(\d{2})$/);
  if (m && +m[1] < 24 && +m[2] < 60) return `${pad(+m[1])}:${m[2]}`;
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
  eat(/\s!(focus|today|must)(?=\s)/i, () => (out.focus = true));
  // reminders first, so their date and time aren't taken as the due date: "remind me tomorrow at 4pm", "remind me fri 9am", "remind me 30m before"
  for (let i = 0; i < 5; i++) {
    let hit = false;
    eat(/\sremind(?:\s+me)?\s+(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)\s+before(?=\s)/i, (m) => { const n = parseFloat(m[1]), u = m[2][0].toLowerCase(); (out.reminders ??= []).push({ before: Math.max(1, Math.round(u === "h" ? n * 60 : u === "d" ? n * 1440 : n)) }); hit = true; });
    if (!hit) eatIf(new RegExp(`\\sremind(?:\\s+me)?(?:\\s+(${DATE_WORD_RE}))?(?:\\s+at)?(?:\\s+(${TIME_RE}))?(?=\\s)`, "i"), (m) => {
      if (!m[1] && !m[2]) return false;
      const date = m[1] ? dateWord(m[1], t) : undefined, time = m[2] ? timeWord(m[2]) : undefined;
      if ((m[1] && !date) || (m[2] && !time)) return false;
      (out.reminders ??= []).push({ ...(date ? { date } : {}), ...(time ? { time } : {}) }); return (hit = true);
    });
    if (!hit) break;
  }
  eatIf(/\s(?:start|starts|starting|hide\s+until):(\S+)(?=\s)/i, (m) => { const d = dateWord(m[1], t); if (d) out.start_date = d; return !!d; });
  // repeats that name days: "every mon and thu", "every last friday", "every first weekday of the quarter", "every 15th", "every 3 days after done"
  eatIf(new RegExp(`\\severy\\s+(${DAY_LIST_RE})(?=\\s)`, "i"), (m) => { try { out.repeat = daysRule(m[1]); return true; } catch { return false; } });
  if (out.repeat === undefined) eatIf(new RegExp(`\\severy\\s+(${ORD_RE}\\s+(?:week|work(?:ing)?|business)\\s?day(?:\\s+of\\s+(?:the\\s+)?(?:month|quarter))?|${ORD_RE}\\s+(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*(?:\\s+of\\s+(?:the\\s+)?month)?|\\d{1,2}(?:st|nd|rd|th)(?:\\s+of\\s+(?:the\\s+)?month)?|last\\s+day\\s+of\\s+(?:the\\s+)?month|(?:\\d+\\s+)?(?:days?|weeks?|months?)\\s+after\\s+(?:done|completion|completing|finishing|i\\s+finish(?:\\s+it)?))(?=\\s)`, "i"),
    (m) => { try { out.repeat = normalizeRepeat(m[1].replace(/\s+/g, " ")); return true; } catch { return false; } });
  if (out.repeat === undefined)
  eat(/\s(?:every\s+(\d+\s*(?:d|w|m|y|days?|weeks?|months?|years?)|day|week|weekday|weekdays|month|year|quarter|fortnight)|(daily|weekly|monthly|yearly|weekdays|quarterly|fortnightly))(?=\s)/i,
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
