import { db } from "./db";
import { addDays, weekday } from "./dates";
import { today } from "./time";

export type Habit = { id: number; name: string; color: string; days: number[]; archived: number };
const hydrate = (r: { id: number; name: string; color: string; days: string; archived: number }): Habit => ({ ...r, days: r.days.split(",").filter(Boolean).map(Number) });
export const listHabits = (): Habit[] => (db.prepare("SELECT * FROM habits WHERE archived=0 ORDER BY id").all() as never[]).map(hydrate);
export const getHabit = (id: number) => { const r = db.prepare("SELECT * FROM habits WHERE id=?").get(id); return r ? hydrate(r as never) : undefined; };
export function createHabit(name: string, o: { color?: string; days?: number[] } = {}): number {
  const days = (o.days?.length ? o.days : [0, 1, 2, 3, 4, 5, 6]).filter((d) => d >= 0 && d <= 6);
  return Number(db.prepare("INSERT INTO habits (name, color, days) VALUES (?,?,?)").run(name.trim(), /^#[0-9a-f]{6}$/i.test(o.color ?? "") ? o.color : "#1877f2", days.join(",")).lastInsertRowid);
}
export const archiveHabit = (id: number) => db.prepare("UPDATE habits SET archived=1 WHERE id=?").run(id).changes > 0;
export function toggleHabit(id: number, date = today()): { done: boolean } | null {
  if (!getHabit(id)) return null;
  const had = db.prepare("DELETE FROM habit_logs WHERE habit_id=? AND date=?").run(id, date).changes > 0;
  if (!had) db.prepare("INSERT INTO habit_logs (habit_id, date) VALUES (?,?)").run(id, date);
  return { done: !had };
}
export const logsFor = (id: number, from: string): Set<string> =>
  new Set((db.prepare("SELECT date FROM habit_logs WHERE habit_id=? AND date>=?").all(id, from) as { date: string }[]).map((r) => r.date));

export type HabitStats = { streak: number; best: number; rate30: number; done: Set<string> };
export function habitStats(h: Habit, t = today()): HabitStats {
  const first = (db.prepare("SELECT min(date) d FROM habit_logs WHERE habit_id=?").get(h.id) as { d: string | null }).d;
  const done = logsFor(h.id, addDays(t, -400));
  const sched = (d: string) => h.days.includes(weekday(d));
  // current streak: scheduled days only; today not yet done doesn't break it
  let streak = 0, d = t;
  if (sched(d) && !done.has(d)) d = addDays(d, -1);
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) { if (!sched(d)) continue; if (done.has(d)) streak++; else break; }
  // best streak
  let best = 0, run = 0;
  if (first) for (let x = first; x <= t; x = addDays(x, 1)) { if (!sched(x)) continue; if (done.has(x)) { run++; best = Math.max(best, run); } else if (x !== t) run = 0; }
  // 30-day completion rate over scheduled days
  let s = 0, c = 0;
  for (let i = 0; i < 30; i++) { const x = addDays(t, -i); if (!sched(x)) continue; s++; if (done.has(x)) c++; }
  return { streak, best, rate30: s ? Math.round((c / s) * 100) : 0, done };
}
export function habitsToday(t = today()) {
  return listHabits().map((h) => { const st = habitStats(h, t); return { ...h, scheduled: h.days.includes(weekday(t)), done: st.done.has(t), streak: st.streak }; });
}
