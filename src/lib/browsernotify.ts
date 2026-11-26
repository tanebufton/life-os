import { db } from "./db";
import { getSetting } from "./settings";
import { completeTask, defaultReminderTime } from "./tasks";
import { fmtTime, nice } from "./dates";
import { localNow } from "./time";

const clampInt = (v: string | null | undefined, d: number, lo: number, hi: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== null && v !== undefined && v !== "" ? Math.min(hi, Math.max(lo, n)) : d; };
/** Browser reminders: on/off, how many minutes before a task's time to remind, and the default snooze. */
export const browserNotifyConfig = () => ({ on: getSetting("notify_browser") === "1", lead: clampInt(getSetting("notify_lead"), 5, 0, 120), snooze: clampInt(getSetting("notify_snooze"), 15, 1, 240) });
export type DueReminder = { id: number; title: string; due: string | null; time: string; project: string | null; token: string; label: string; kind: "due" | "reminder" | "default" };
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
/** Minutes from `a` to `b`, both local "YYYY-MM-DD HH:MM". */
const span = (a: string, b: string) => (Date.parse(`${b.slice(0, 10)}T${b.slice(11, 16)}:00Z`) - Date.parse(`${a.slice(0, 10)}T${a.slice(11, 16)}:00Z`)) / 60_000;
const WINDOW = 180; // a reminder keeps nudging for three hours after its time, so a restart or a closed laptop doesn't lose it, but never replays a whole day
const dayLabel = (due: string | null, time: string | null, today: string) => (!due ? "" : `due ${due === today ? "today" : nice(due)}${time ? ` ${fmtTime(time)}` : ""}`);

/**
 * Reminders you set on a task (any number, at any time) and, when a default reminder time is set, tasks due today with no time of their own.
 * Not snooze-aware: `dueReminders` adds that for the pop-up and push. The worker's ntfy / webhook / Telegram channels use this directly.
 */
export function extraReminders(now = new Date()): DueReminder[] {
  const n = localNow(now), stamp = `${n.date} ${n.hm}`, out: DueReminder[] = [];
  const rows = db.prepare(`SELECT r.id AS rid, r.at, r.before_min, t.id, t.title, t.due, t.due_time, p.name AS project FROM task_reminders r JOIN tasks t ON t.id=r.task_id LEFT JOIN projects p ON p.id=t.project_id
    WHERE t.deleted_at IS NULL AND t.done_at IS NULL`).all() as { rid: number; at: string | null; before_min: number | null; id: number; title: string; due: string | null; due_time: string | null; project: string | null }[];
  for (const r of rows) {
    let at = r.at;
    if (!at && r.before_min && r.due) { const base = `${r.due} ${r.due_time ?? (defaultReminderTime() || "09:00")}`, d = new Date(Date.parse(`${base.slice(0, 10)}T${base.slice(11)}:00Z`) - r.before_min * 60_000).toISOString(); at = `${d.slice(0, 10)} ${d.slice(11, 16)}`; }
    if (!at) continue;
    const late = span(at, stamp); if (late < 0 || late > WINDOW) continue;
    out.push({ id: r.id, title: r.title, due: r.due, time: at.slice(11, 16), project: r.project, kind: "reminder", token: `${r.id}:r${r.rid}:${at}`, label: ["Reminder", dayLabel(r.due, r.due_time, n.date)].filter(Boolean).join(" · ") });
  }
  const dt = getSetting("remind_default_on") === "1" ? defaultReminderTime() : "";
  if (dt) {
    const late = mins(n.hm) - mins(dt);
    if (late >= 0 && late <= WINDOW) for (const t of db.prepare(`SELECT t.id, t.title, t.due, p.name AS project FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
      WHERE t.deleted_at IS NULL AND t.done_at IS NULL AND t.due=? AND t.due_time IS NULL AND (t.start_date IS NULL OR t.start_date<=?)
      AND NOT EXISTS (SELECT 1 FROM task_reminders r WHERE r.task_id=t.id) ORDER BY t.priority DESC, t.id`).all(n.date, n.date) as { id: number; title: string; due: string; project: string | null }[])
      out.push({ id: t.id, title: t.title, due: t.due, time: dt, project: t.project, kind: "default", token: `${t.id}:d:${t.due}:${dt}`, label: "Due today" });
  }
  return out;
}

/**
 * Everything that should be nudging you right now: timed tasks due today (from `lead` minutes before their time until three hours after),
 * reminders you set, and dated tasks with no time at the default reminder time (if that is on). Snoozed tasks wait until the snooze ends.
 * `token` changes when the task is snoozed, so the page notifies again after the snooze ends.
 */
export function dueReminders(now = new Date()): DueReminder[] {
  const cfg = browserNotifyConfig(), n = localNow(now), nm = mins(n.hm), stamp = `${n.date} ${n.hm}`;
  const rows = db.prepare(`SELECT t.id, t.title, t.due, t.due_time, p.name AS project FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
    WHERE t.deleted_at IS NULL AND t.done_at IS NULL AND t.due=? AND t.due_time IS NOT NULL ORDER BY t.due_time`).all(n.date) as { id: number; title: string; due: string; due_time: string; project: string | null }[];
  const timed: DueReminder[] = rows.filter((r) => { const dm = mins(r.due_time); return nm >= dm - cfg.lead && nm <= dm + WINDOW; })
    .map((r) => ({ id: r.id, title: r.title, due: r.due, time: r.due_time, project: r.project, kind: "due", token: `${r.id}:${r.due}:${r.due_time}`, label: `Due ${fmtTime(r.due_time)}` }));
  const snoozes = new Map((db.prepare("SELECT task_id, until FROM reminder_snooze").all() as { task_id: number; until: string }[]).map((s) => [s.task_id, s.until]));
  return [...timed, ...extraReminders(now)].filter((r) => { const s = snoozes.get(r.id); return !s || s <= stamp; }).map((r) => ({ ...r, token: `${r.token}:${snoozes.get(r.id) ?? ""}` }));
}
/** Hide this task's reminder for a while. Default is the snooze length from settings (15 minutes). */
export function snoozeReminder(id: number, minutes?: number, now = new Date()): string {
  const m = Math.min(240, Math.max(1, Math.round(minutes ?? browserNotifyConfig().snooze))), until = localNow(new Date(now.getTime() + m * 60_000)), v = `${until.date} ${until.hm}`;
  db.prepare("INSERT INTO reminder_snooze (task_id, until) VALUES (?,?) ON CONFLICT(task_id) DO UPDATE SET until=excluded.until").run(id, v); return v;
}
export const doneFromReminder = (id: number) => !!completeTask(id);
