import { db } from "./db";
import { queryTasks } from "./tasks";

const SECRET = /^(spotify_|ntfy_token|ical_secret|inbound_secret|webhook_url|telegram_|backup_)/;
export function exportAll() {
  const settings = Object.fromEntries((db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[]).filter((r) => !SECRET.test(r.key)).map((r) => [r.key, r.value]));
  return {
    exported_at: new Date().toISOString(), version: 1,
    projects: db.prepare("SELECT * FROM projects").all(),
    tasks: queryTasks({ state: "all", includeSub: true, limit: 100000 }),
    habits: db.prepare("SELECT * FROM habits").all(), habit_logs: db.prepare("SELECT * FROM habit_logs").all(),
    journal: db.prepare("SELECT * FROM journal").all(), focus_sessions: db.prepare("SELECT * FROM focus_sessions").all(),
    feeds: db.prepare("SELECT url, title FROM feeds").all(), settings,
  };
}
const q = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function tasksCsv(): string {
  const rows = queryTasks({ state: "all", includeSub: true, limit: 100000 });
  const head = ["id", "parent_id", "title", "notes", "project", "tags", "status", "priority", "due", "due_time", "estimate_min", "repeat", "done_at", "source"];
  return [head.join(","), ...rows.map((t) => [t.id, t.parent_id, t.title, t.notes, t.project_name, t.tags.join(" "), t.status, t.priority, t.due, t.due_time, t.estimate, t.repeat, t.done_at, t.source].map(q).join(","))].join("\n") + "\n";
}
