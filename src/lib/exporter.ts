import { db } from "./db";
import { queryTasks } from "./tasks";

import { entityTags } from "./entitytags";
const all = (table: string) => { try { return db.prepare(`SELECT * FROM ${table}`).all(); } catch { return []; } };
const SECRET = /^(spotify_|ntfy_token|ical_secret|inbound_secret|webhook_url|telegram_|backup_)/;
export function exportAll() {
  const settings = Object.fromEntries((db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[]).filter((r) => !SECRET.test(r.key)).map((r) => [r.key, r.value]));
  return {
    exported_at: new Date().toISOString(), version: 2,
    projects: db.prepare("SELECT * FROM projects").all(),
    columns: db.prepare("SELECT * FROM statuses ORDER BY project_id, position").all(),
    tasks: queryTasks({ state: "all", includeSub: true, limit: 100000 }),
    task_comments: all("task_comments"), tags: all("tags"), item_links: all("item_links"),
    notes: (db.prepare("SELECT * FROM notes WHERE deleted_at IS NULL").all() as { id: number }[]).map((n) => ({ ...n, tags: entityTags("note", n.id) })), note_versions: all("note_versions"),
    goals: (db.prepare("SELECT * FROM goals").all() as { id: number }[]).map((g) => ({ ...g, tags: entityTags("goal", g.id) })), key_results: all("key_results"),
    people: (db.prepare("SELECT * FROM people").all() as { id: number }[]).map((p) => ({ ...p, tags: entityTags("person", p.id) })), interactions: all("interactions"),
    voice_memos: db.prepare("SELECT * FROM voice_memos WHERE deleted_at IS NULL").all(), templates: all("templates"), saved_filters: all("saved_filters"),
    habits: db.prepare("SELECT * FROM habits").all(), habit_logs: db.prepare("SELECT * FROM habit_logs").all(),
    journal: db.prepare("SELECT * FROM journal").all(), focus_sessions: db.prepare("SELECT * FROM focus_sessions").all(),
    money: { categories: all("money_categories"), budgets: all("budget_overrides"), rules: all("money_rules"), transactions: all("transactions"), savings: all("savings_goals"), subscriptions: all("subscriptions"), price_history: all("sub_price_history") },
    activity: db.prepare("SELECT * FROM activity ORDER BY id DESC LIMIT 20000").all(),
    feeds: db.prepare("SELECT url, title FROM feeds").all(), calendars: db.prepare("SELECT id, name, color, enabled FROM cal_feeds").all(), // calendar URLs are secrets, so left out
    settings,
  };
}
const q = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function tasksCsv(): string {
  const rows = queryTasks({ state: "all", includeSub: true, limit: 100000 });
  const head = ["id", "parent_id", "title", "notes", "project", "tags", "status", "priority", "due", "due_time", "estimate_min", "repeat", "done_at", "source"];
  return [head.join(","), ...rows.map((t) => [t.id, t.parent_id, t.title, t.notes, t.project_name, t.tags.join(" "), t.status, t.priority, t.due, t.due_time, t.estimate, t.repeat, t.done_at, t.source].map(q).join(","))].join("\n") + "\n";
}
