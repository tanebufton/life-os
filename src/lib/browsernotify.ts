import { db } from "./db";
import { getSetting } from "./settings";
import { completeTask } from "./tasks";
import { localNow } from "./time";

const clampInt = (v: string | null | undefined, d: number, lo: number, hi: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== null && v !== undefined && v !== "" ? Math.min(hi, Math.max(lo, n)) : d; };
/** Browser reminders: on/off, how many minutes before a task's time to remind, and the default snooze. */
export const browserNotifyConfig = () => ({ on: getSetting("notify_browser") === "1", lead: clampInt(getSetting("notify_lead"), 5, 0, 120), snooze: clampInt(getSetting("notify_snooze"), 15, 1, 240) });
export type DueReminder = { id: number; title: string; due: string; time: string; project: string | null; token: string };
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/**
 * Timed tasks that should be nudging you right now: due today, not done, from `lead` minutes before their time until three hours after,
 * and not currently snoozed. `token` changes when the task is snoozed, so the page notifies again after the snooze ends.
 */
export function dueReminders(now = new Date()): DueReminder[] {
  const cfg = browserNotifyConfig(), n = localNow(now), nm = mins(n.hm);
  const rows = db.prepare(`SELECT t.id, t.title, t.due, t.due_time, p.name AS project, s.until AS snooze FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN reminder_snooze s ON s.task_id=t.id
    WHERE t.deleted_at IS NULL AND t.done_at IS NULL AND t.due=? AND t.due_time IS NOT NULL ORDER BY t.due_time`).all(n.date) as { id: number; title: string; due: string; due_time: string; project: string | null; snooze: string | null }[];
  return rows.filter((r) => { const dm = mins(r.due_time); if (nm < dm - cfg.lead || nm > dm + 180) return false; return !r.snooze || r.snooze <= `${n.date} ${n.hm}`; })
    .map((r) => ({ id: r.id, title: r.title, due: r.due, time: r.due_time, project: r.project, token: `${r.id}:${r.due}:${r.due_time}:${r.snooze ?? ""}` }));
}
/** Hide this task's reminder for a while. Default is the snooze length from settings (15 minutes). */
export function snoozeReminder(id: number, minutes?: number, now = new Date()): string {
  const m = Math.min(240, Math.max(1, Math.round(minutes ?? browserNotifyConfig().snooze))), until = localNow(new Date(now.getTime() + m * 60_000)), v = `${until.date} ${until.hm}`;
  db.prepare("INSERT INTO reminder_snooze (task_id, until) VALUES (?,?) ON CONFLICT(task_id) DO UPDATE SET until=excluded.until").run(id, v); return v;
}
export const doneFromReminder = (id: number) => !!completeTask(id);
