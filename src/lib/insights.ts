import { db } from "./db";
import { addDays, weekday } from "./dates";
import { focusStats } from "./focus";
import { localDate, today } from "./time";

export function completionsByDay(days = 182): Map<string, number> {
  const rows = db.prepare("SELECT done_at FROM tasks WHERE done_at >= datetime('now', ?) AND deleted_at IS NULL").all(`-${days + 1} days`) as { done_at: string }[];
  const m = new Map<string, number>();
  for (const r of rows) { const d = localDate(r.done_at); m.set(d, (m.get(d) ?? 0) + 1); }
  return m;
}
export function insights(t = today()) {
  const by = completionsByDay(182);
  const heat = Array.from({ length: 182 }, (_, i) => { const date = addDays(t, i - 181); return { date, count: by.get(date) ?? 0 }; });
  const sum = (from: number, to: number) => { let n = 0; for (let i = from; i <= to; i++) n += by.get(addDays(t, -i)) ?? 0; return n; };
  let streak = 0, d = (by.get(t) ?? 0) > 0 ? t : addDays(t, -1);
  while ((by.get(d) ?? 0) > 0) { streak++; d = addDays(d, -1); }
  let best = 0, run = 0; for (const h of heat) { run = h.count ? run + 1 : 0; best = Math.max(best, run); }
  const since = `-30 days`;
  const byProject = db.prepare(`SELECT COALESCE(p.name,'No project') AS name, COALESCE(p.color,'#9b9a97') AS color, count(*) AS count
    FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.done_at >= datetime('now', ?) AND t.deleted_at IS NULL GROUP BY p.id ORDER BY count DESC LIMIT 6`).all(since) as { name: string; color: string; count: number }[];
  const fs = focusStats(14), fmin = (a: number, b: number) => fs.filter((x) => x.date >= addDays(t, -a) && x.date <= addDays(t, -b)).reduce((n, x) => n + x.minutes, 0);
  const byWeekday = Array(7).fill(0) as number[]; for (const h of heat) byWeekday[(weekday(h.date) + 6) % 7] += h.count; // Mon..Sun
  return {
    byWeekday, heat, total: heat.reduce((n, h) => n + h.count, 0), streak, bestStreak: best,
    thisWeek: sum(0, 6), lastWeek: sum(7, 13), byProject,
    focusWeek: fmin(6, 0), focusPrev: fmin(13, 7),
    bestDay: heat.reduce((b, h) => (h.count > b.count ? h : b), { date: "", count: 0 }),
  };
}
