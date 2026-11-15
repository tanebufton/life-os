import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const file = process.env.LIFEOS_DB ?? path.join(process.cwd(), "data", "lifeos.db");
fs.mkdirSync(path.dirname(file), { recursive: true });

const g = globalThis as unknown as { __db?: Database.Database };
export const db = (g.__db ??= (() => {
  const d = new Database(file);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
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
  `);
  return d;
})());

export type Project = { id: number; name: string; color: string; archived: number };
export type Task = { id: number; title: string; notes: string; project_id: number | null; priority: number; due: string | null; done_at: string | null };
