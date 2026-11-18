import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const file = process.env.LIFEOS_DB ?? path.join(process.cwd(), "data", "lifeos.db");
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
  d.exec("UPDATE tasks SET status='done' WHERE done_at IS NOT NULL AND status!='done'");
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
