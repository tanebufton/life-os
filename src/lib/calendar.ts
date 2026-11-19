import ical from "node-ical";
import { db } from "./db";
import { addDays } from "./dates";
import { assertPublicUrl } from "./netsafe";
import { localNow, today } from "./time";

export type Feed = { id: number; name: string; url: string; color: string; enabled: number; last_synced: string | null; last_error: string | null };
export type CalEvent = { id: number; feed_id: number; uid: string; title: string; date: string; start_time: string | null; end_date: string | null; end_time: string | null; all_day: number; location: string; color?: string; feed?: string };
export const listFeeds = () => db.prepare("SELECT * FROM cal_feeds ORDER BY id").all() as Feed[];
export function addFeed(name: string, url: string, color = "#8b5cf6"): number {
  const u = url.trim().replace(/^webcal:\/\//i, "https://"); allowFetch(u);
  return Number(db.prepare("INSERT INTO cal_feeds (name, url, color) VALUES (?,?,?)").run(name.trim() || new URL(u).hostname, u, color).lastInsertRowid);
}
export const removeFeed = (id: number) => db.prepare("DELETE FROM cal_feeds WHERE id=?").run(id).changes > 0;
function allowFetch(u: string) { if (process.env.LIFEOS_ALLOW_PRIVATE_FETCH === "1") { if (!/^https?:\/\//i.test(u)) throw new Error("Calendar URL must be http(s)"); } else assertPublicUrl(u); }
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // date-only values are created in server-local time

type Raw = { type?: string; uid?: string; summary?: unknown; location?: string; start?: Date & { dateOnly?: boolean }; end?: Date & { dateOnly?: boolean }; datetype?: string; rrule?: { between: (a: Date, b: Date, inc?: boolean) => Date[] }; exdate?: Record<string, Date>; recurrences?: Record<string, Raw>; recurrenceid?: Date };
const text = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && "val" in v ? String((v as { val: unknown }).val) : "").trim();

/** Turns ICS text into dated occurrences for [from, to] (recurring events expanded, exceptions honoured). Pure apart from the timezone setting. */
export function expandIcs(textIcs: string, from: string, to: string): Omit<CalEvent, "id" | "feed_id">[] {
  const parsed = ical.sync.parseICS(textIcs) as Record<string, Raw>, out: Omit<CalEvent, "id" | "feed_id">[] = [];
  const fromD = new Date(from + "T00:00:00Z"), toD = new Date(to + "T23:59:59Z");
  const emit = (ev: Raw, start: Date, durMs: number, uid: string) => {
    const allDay = ev.datetype === "date" || !!ev.start?.dateOnly, title = text(ev.summary) || "(untitled)", location = (ev.location ?? "").toString();
    if (allDay) {
      const d = localDate(start), lastDay = durMs > 86_400_000 ? localDate(new Date(start.getTime() + durMs - 1000)) : null;
      out.push({ uid, title, date: d, start_time: null, end_date: lastDay && lastDay > d ? lastDay : null, end_time: null, all_day: 1, location });
    } else {
      const s = localNow(start), e = localNow(new Date(start.getTime() + durMs));
      out.push({ uid, title, date: s.date, start_time: s.hm, end_date: e.date > s.date ? e.date : null, end_time: e.hm, all_day: 0, location });
    }
  };
  for (const [key, ev] of Object.entries(parsed)) {
    if (ev.type !== "VEVENT" || !ev.start) continue;
    const dur = ev.end ? ev.end.getTime() - ev.start.getTime() : ev.datetype === "date" ? 86_400_000 : 0, uid = ev.uid ?? key;
    if (ev.rrule) {
      for (const occ of ev.rrule.between(new Date(fromD.getTime() - 2 * 86_400_000), toD, true)) {
        const k = occ.toISOString().slice(0, 10);
        if (ev.exdate && Object.values(ev.exdate).some((x) => x.toISOString().slice(0, 10) === k)) continue;
        const o = ev.recurrences && Object.entries(ev.recurrences).find(([rk]) => rk.slice(0, 10) === k)?.[1];
        const base = o ?? ev, start = o?.start ?? occ;
        emit(base, start, base.end && base.start ? base.end.getTime() - base.start.getTime() : dur, uid + "@" + k);
      }
    } else if (ev.start >= new Date(fromD.getTime() - 2 * 86_400_000) && ev.start <= toD) emit(ev, ev.start, dur, uid);
  }
  return out.filter((o) => (o.end_date ?? o.date) >= from && o.date <= to).sort((a, b) => (a.date + (a.start_time ?? "")).localeCompare(b.date + (b.start_time ?? "")));
}
async function fetchText(url: string) {
  allowFetch(url);
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "LifeOS/0.4 (calendar sync)", accept: "text/calendar, */*" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text(); if (!/BEGIN:VCALENDAR/i.test(t.slice(0, 2000))) throw new Error("That URL isn't an iCalendar (.ics) feed");
  return t.slice(0, 8_000_000);
}
export async function syncFeed(id: number, t = today()): Promise<{ events: number; error?: string }> {
  const f = db.prepare("SELECT * FROM cal_feeds WHERE id=?").get(id) as Feed | undefined; if (!f) return { events: 0, error: "No such feed" };
  try {
    const evs = expandIcs(await fetchText(f.url), addDays(t, -7), addDays(t, 90));
    db.transaction(() => { db.prepare("DELETE FROM cal_events WHERE feed_id=?").run(id); const ins = db.prepare("INSERT INTO cal_events (feed_id, uid, title, date, start_time, end_date, end_time, all_day, location) VALUES (?,?,?,?,?,?,?,?,?)");
      for (const e of evs.slice(0, 3000)) ins.run(id, e.uid, e.title, e.date, e.start_time, e.end_date, e.end_time, e.all_day, e.location);
      db.prepare("UPDATE cal_feeds SET last_synced=datetime('now'), last_error=NULL WHERE id=?").run(id); })();
    return { events: evs.length };
  } catch (e) { db.prepare("UPDATE cal_feeds SET last_error=? WHERE id=?").run((e as Error).message, id); return { events: 0, error: (e as Error).message }; }
}
export async function syncAll() { const r: Record<number, { events: number; error?: string }> = {}; for (const f of listFeeds().filter((x) => x.enabled)) r[f.id] = await syncFeed(f.id); return r; }
export function eventsOn(date: string): CalEvent[] {
  return db.prepare("SELECT e.*, f.color, f.name AS feed FROM cal_events e JOIN cal_feeds f ON f.id=e.feed_id WHERE f.enabled=1 AND e.date<=? AND COALESCE(e.end_date, e.date)>=? ORDER BY e.all_day DESC, e.start_time").all(date, date) as CalEvent[];
}
export function eventsBetween(from: string, to: string): CalEvent[] {
  return db.prepare("SELECT e.*, f.color, f.name AS feed FROM cal_events e JOIN cal_feeds f ON f.id=e.feed_id WHERE f.enabled=1 AND e.date<=? AND COALESCE(e.end_date, e.date)>=? ORDER BY e.date, e.all_day DESC, e.start_time").all(to, from) as CalEvent[];
}
