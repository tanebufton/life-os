import { db } from "./db";
import { addDays } from "./dates";
import { today } from "./time";

export type Entry = { date: string; mood: number | null; body: string; updated_at: string };
export const getEntry = (date = today()): Entry | undefined => db.prepare("SELECT * FROM journal WHERE date=?").get(date) as Entry | undefined;
export function saveEntry(date: string, p: { mood?: number | null; body?: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const cur = getEntry(date);
  const mood = p.mood === undefined ? cur?.mood ?? null : p.mood === null ? null : Math.max(1, Math.min(5, Math.round(p.mood)));
  const body = p.body === undefined ? cur?.body ?? "" : p.body.slice(0, 50_000);
  db.prepare("INSERT INTO journal (date, mood, body, updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(date) DO UPDATE SET mood=excluded.mood, body=excluded.body, updated_at=datetime('now')").run(date, mood, body);
}
export function listEntries(o: { q?: string; limit?: number } = {}): Entry[] {
  const like = o.q ? `%${o.q.replace(/[\\%_]/g, (c) => "\\" + c)}%` : null;
  return db.prepare(`SELECT * FROM journal WHERE (body!='' OR mood IS NOT NULL) ${like ? "AND body LIKE ? ESCAPE '\\'" : ""} ORDER BY date DESC LIMIT ?`).all(...(like ? [like] : []), o.limit ?? 60) as Entry[];
}
export function moodSeries(days = 30, t = today()): { date: string; mood: number | null }[] {
  const from = addDays(t, -(days - 1));
  const by = new Map((db.prepare("SELECT date, mood FROM journal WHERE date>=?").all(from) as { date: string; mood: number | null }[]).map((r) => [r.date, r.mood]));
  return Array.from({ length: days }, (_, i) => { const date = addDays(from, i); return { date, mood: by.get(date) ?? null }; });
}
export const journalStreak = (t = today()) => { let n = 0, d = getEntry(t)?.body ? t : addDays(t, -1); while (getEntry(d)?.body) { n++; d = addDays(d, -1); } return n; };
