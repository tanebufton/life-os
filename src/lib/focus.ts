import { db } from "./db";
import { localDate, today } from "./time";

export function logFocus(o: { seconds: number; kind?: "focus" | "break"; task_id?: number | null; label?: string }) {
  const seconds = Math.max(1, Math.min(Math.round(o.seconds), 6 * 3600));
  return Number(db.prepare("INSERT INTO focus_sessions (kind, seconds, task_id, label) VALUES (?,?,?,?)")
    .run(o.kind ?? "focus", seconds, o.task_id ?? null, o.label ?? "").lastInsertRowid);
}
export function focusStats(days = 7): { date: string; minutes: number; sessions: number }[] {
  const rows = db.prepare("SELECT seconds, ended_at FROM focus_sessions WHERE kind='focus' AND ended_at >= datetime('now', ?)")
    .all(`-${days + 1} days`) as { seconds: number; ended_at: string }[];
  const by = new Map<string, { s: number; n: number }>();
  for (const r of rows) { const d = localDate(r.ended_at); const e = by.get(d) ?? { s: 0, n: 0 }; e.s += r.seconds; e.n++; by.set(d, e); }
  return [...by].sort().slice(-days).map(([date, v]) => ({ date, minutes: Math.round(v.s / 60), sessions: v.n }));
}
export const focusToday = () => focusStats(2).find((d) => d.date === today()) ?? { date: today(), minutes: 0, sessions: 0 };
