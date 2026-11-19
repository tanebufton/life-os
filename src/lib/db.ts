import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export const dbFile = process.env.LIFEOS_DB ?? path.join(process.cwd(), "data", "lifeos.db");
const file = dbFile;
fs.mkdirSync(path.dirname(file), { recursive: true });

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#6366f1',
      archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      priority INTEGER NOT NULL DEFAULT 0, due TEXT, done_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS tasks_project ON tasks(project_id);
    CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE);
    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, tag_id)
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS feeds (id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id INTEGER PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'focus', seconds INTEGER NOT NULL,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL, label TEXT NOT NULL DEFAULT '',
      ended_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const cols = (d.prepare("PRAGMA table_info(tasks)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("status")) d.exec("ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'todo'");
  if (!cols.includes("repeat")) d.exec("ALTER TABLE tasks ADD COLUMN repeat TEXT");
  const add = (col: string, ddl: string) => { if (!cols.includes(col)) d.exec(`ALTER TABLE tasks ADD COLUMN ${ddl}`); };
  add("parent_id", "parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE");
  add("due_time", "due_time TEXT");           // "HH:MM" local
  add("estimate", "estimate INTEGER");        // minutes
  add("source", "source TEXT NOT NULL DEFAULT 'manual'"); // manual | email | api | share | mcp
  add("meta", "meta TEXT");                   // JSON (e.g. email sender)
  add("deleted_at", "deleted_at TEXT");       // soft delete, purged after 30 days
  d.exec(`
    CREATE INDEX IF NOT EXISTS tasks_parent ON tasks(parent_id);
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#1877f2',
      days TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6', archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS habit_logs (
      habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE, date TEXT NOT NULL, PRIMARY KEY (habit_id, date)
    );
    CREATE TABLE IF NOT EXISTS journal (
      date TEXT PRIMARY KEY, mood INTEGER, body TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), last_used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS email_log (
      message_id TEXT PRIMARY KEY, sender TEXT, subject TEXT, task_id INTEGER, received_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notifications_sent (key TEXT PRIMARY KEY, sent_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS money_categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#1877f2', kind TEXT NOT NULL DEFAULT 'expense', budget_cents INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS budget_overrides (category_id INTEGER NOT NULL REFERENCES money_categories(id) ON DELETE CASCADE, month TEXT NOT NULL, amount_cents INTEGER NOT NULL, PRIMARY KEY (category_id, month));
    CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT NOT NULL, amount_cents INTEGER NOT NULL, payee TEXT NOT NULL DEFAULT '', category_id INTEGER REFERENCES money_categories(id) ON DELETE SET NULL,
      note TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'manual', sub_id INTEGER, hash TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS tx_date ON transactions(date);
    CREATE TABLE IF NOT EXISTS money_rules (id INTEGER PRIMARY KEY, pattern TEXT NOT NULL, category_id INTEGER NOT NULL REFERENCES money_categories(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS savings_goals (id INTEGER PRIMARY KEY, name TEXT NOT NULL, target_cents INTEGER NOT NULL, saved_cents INTEGER NOT NULL DEFAULT 0, due TEXT, color TEXT NOT NULL DEFAULT '#1f845a', archived INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY, name TEXT NOT NULL, amount_cents INTEGER NOT NULL, cycle TEXT NOT NULL DEFAULT 'monthly', next_due TEXT NOT NULL, category_id INTEGER REFERENCES money_categories(id) ON DELETE SET NULL,
      url TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', trial_ends TEXT, status TEXT NOT NULL DEFAULT 'active', remind_days INTEGER NOT NULL DEFAULT 3, auto_log INTEGER NOT NULL DEFAULT 1,
      color TEXT NOT NULL DEFAULT '#1877f2', started TEXT, cancelled_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS sub_price_history (id INTEGER PRIMARY KEY, sub_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE, amount_cents INTEGER NOT NULL, from_date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS goals (id INTEGER PRIMARY KEY, title TEXT NOT NULL, area TEXT NOT NULL DEFAULT 'General', target_date TEXT, project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS key_results (id INTEGER PRIMARY KEY, goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE, title TEXT NOT NULL, target REAL NOT NULL DEFAULT 100, current REAL NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY, name TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', birthday TEXT, cadence_days INTEGER, last_contact TEXT, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS interactions (id INTEGER PRIMARY KEY, person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE, date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS cal_feeds (id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, color TEXT NOT NULL DEFAULT '#8b5cf6', enabled INTEGER NOT NULL DEFAULT 1, last_synced TEXT, last_error TEXT);
    CREATE TABLE IF NOT EXISTS cal_events (id INTEGER PRIMARY KEY, feed_id INTEGER NOT NULL REFERENCES cal_feeds(id) ON DELETE CASCADE, uid TEXT NOT NULL, title TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT, end_date TEXT, end_time TEXT, all_day INTEGER NOT NULL DEFAULT 0, location TEXT NOT NULL DEFAULT '');
    CREATE INDEX IF NOT EXISTS cal_events_date ON cal_events(date);
    CREATE TABLE IF NOT EXISTS voice_memos (id INTEGER PRIMARY KEY, text TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'web', task_id INTEGER, note_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS task_comments (id INTEGER PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS saved_filters (id INTEGER PRIMARY KEY, name TEXT NOT NULL, query TEXT NOT NULL);
  `);
  d.exec("UPDATE tasks SET status='done' WHERE done_at IS NOT NULL AND status!='done'");
  d.exec("DELETE FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')");
  if (!(d.prepare("SELECT count(*) AS n FROM feeds").get() as { n: number }).n) {
    const ins = d.prepare("INSERT INTO feeds (url, title) VALUES (?,?)");
    ins.run("https://hnrss.org/frontpage", "Hacker News");
    ins.run("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC World");
  }
}

const g = globalThis as unknown as { __db?: Database.Database };
export const db = (g.__db ??= (() => {
  const d = new Database(file);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  d.pragma("busy_timeout = 5000"); // web app + MCP server share this file
  migrate(d);
  return d;
})());

export type Project = { id: number; name: string; color: string; archived: number };
