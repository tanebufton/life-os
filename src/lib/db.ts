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
  // Board columns. A status is a column with a "kind" (todo/doing/done) so counts, reminders and Today keep working with custom names.
  // project_id NULL = the default set; a project can own its own set. Keys are unique across all sets, so a key alone identifies a column.
  d.exec(`CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('todo','doing','done')), position INTEGER NOT NULL DEFAULT 0
  );`);
  if (!(d.prepare("SELECT 1 FROM statuses WHERE project_id IS NULL LIMIT 1").get())) {
    const ins = d.prepare("INSERT INTO statuses (project_id, key, name, kind, position) VALUES (NULL, ?, ?, ?, ?)");
    ins.run("todo", "To do", "todo", 0); ins.run("doing", "In progress", "doing", 1); ins.run("done", "Done", "done", 2);
  }
  // API token scopes (added after the table existed in earlier versions)
  const tcols = (d.prepare("PRAGMA table_info(api_tokens)").all() as { name: string }[]).map((c) => c.name);
  if (!tcols.includes("level")) d.exec("ALTER TABLE api_tokens ADD COLUMN level TEXT NOT NULL DEFAULT 'write'"); // existing tokens keep read+write
  if (!tcols.includes("areas")) d.exec("ALTER TABLE api_tokens ADD COLUMN areas TEXT"); // JSON list, null = every area
  if (!tcols.includes("expires_at")) d.exec("ALTER TABLE api_tokens ADD COLUMN expires_at TEXT");
  // Notes can belong to a project; tags work on any kind of item; every change is recorded in an activity log; notes keep earlier versions.
  const ncols = (d.prepare("PRAGMA table_info(notes)").all() as { name: string }[]).map((c) => c.name);
  if (!ncols.includes("project_id")) d.exec("ALTER TABLE notes ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL");
  // v6: nested notes (pages and sub-pages), emoji icons, project areas, favourites. All additive; nothing existing changes.
  const has = (t: string, c: string) => (d.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).some((x) => x.name === c);
  if (!has("notes", "parent_id")) d.exec("ALTER TABLE notes ADD COLUMN parent_id INTEGER REFERENCES notes(id) ON DELETE SET NULL");
  if (!has("notes", "icon")) d.exec("ALTER TABLE notes ADD COLUMN icon TEXT NOT NULL DEFAULT ''");
  if (!has("projects", "icon")) d.exec("ALTER TABLE projects ADD COLUMN icon TEXT NOT NULL DEFAULT ''");
  if (!has("projects", "area")) d.exec("ALTER TABLE projects ADD COLUMN area TEXT NOT NULL DEFAULT ''");
  d.exec("CREATE TABLE IF NOT EXISTS favourites (kind TEXT NOT NULL, ref_id INTEGER NOT NULL, position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (kind, ref_id))");
  // v8: which pay periods you have already set money aside for. Additive.
  d.exec("CREATE TABLE IF NOT EXISTS payday_setaside (period_start TEXT PRIMARY KEY, done_at TEXT NOT NULL DEFAULT (datetime('now')))");
  // v7 (projects): the view a project opens to, and a manual order within its area. Additive; 0 / '' mean "as before".
  if (!has("projects", "default_view")) d.exec("ALTER TABLE projects ADD COLUMN default_view TEXT NOT NULL DEFAULT ''");
  if (!has("projects", "position")) d.exec("ALTER TABLE projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0");
  // v7: which subscription charges you have paid (per due date), and reminder snoozes. Additive.
  d.exec("CREATE TABLE IF NOT EXISTS sub_paid (sub_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE, due_date TEXT NOT NULL, paid_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (sub_id, due_date))");
  d.exec("CREATE TABLE IF NOT EXISTS reminder_snooze (task_id INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE, until TEXT NOT NULL)");
  // v5: voice memos can belong to a project (existing memos stay unassigned)
  if (!(d.prepare("PRAGMA table_info(voice_memos)").all() as { name: string }[]).some((c) => c.name === "project_id")) d.exec("ALTER TABLE voice_memos ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL");
  d.exec(`
    CREATE TABLE IF NOT EXISTS entity_tags (kind TEXT NOT NULL, entity_id INTEGER NOT NULL, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (kind, entity_id, tag_id));
    CREATE INDEX IF NOT EXISTS entity_tags_tag ON entity_tags(tag_id);
    CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY, entity TEXT NOT NULL, entity_id INTEGER NOT NULL, action TEXT NOT NULL, field TEXT, old TEXT, new TEXT, actor TEXT NOT NULL DEFAULT 'you', at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS activity_entity ON activity(entity, entity_id, id);
    CREATE TABLE IF NOT EXISTS note_versions (id INTEGER PRIMARY KEY, note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS note_versions_note ON note_versions(note_id, id);
    CREATE TABLE IF NOT EXISTS item_links (id INTEGER PRIMARY KEY, a_kind TEXT NOT NULL, a_id INTEGER NOT NULL, b_kind TEXT NOT NULL, b_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (a_kind, a_id, b_kind, b_id));
    CREATE INDEX IF NOT EXISTS item_links_b ON item_links(b_kind, b_id);
  `);
  // Manual card/task order, note edit counter (for conflict detection) and tag colours. All optional, so nothing existing changes.
  const t2 = (d.prepare("PRAGMA table_info(tasks)").all() as { name: string }[]).map((c) => c.name);
  if (!t2.includes("position")) d.exec("ALTER TABLE tasks ADD COLUMN position REAL");
  const n2 = (d.prepare("PRAGMA table_info(notes)").all() as { name: string }[]).map((c) => c.name);
  if (!n2.includes("rev")) d.exec("ALTER TABLE notes ADD COLUMN rev INTEGER NOT NULL DEFAULT 0");
  const g2 = (d.prepare("PRAGMA table_info(tags)").all() as { name: string }[]).map((c) => c.name);
  if (!g2.includes("color")) d.exec("ALTER TABLE tags ADD COLUMN color TEXT");
}

/** Bump when the schema changes. Existing databases below this get an automatic safety copy before they are migrated. */
export const SCHEMA_VERSION = 8;
/**
 * Before upgrading an existing database to a newer schema, save a complete copy next to it (VACUUM INTO is safe while the app runs).
 * If this can't be written the upgrade stops rather than risk your data; set LIFEOS_SKIP_UPGRADE_BACKUP=1 to override. Keeps the newest 3.
 */
function safetyCopy(d: Database.Database) {
  const v = Number(d.pragma("user_version", { simple: true })) || 0;
  if (v >= SCHEMA_VERSION || process.env.LIFEOS_SKIP_UPGRADE_BACKUP === "1") return;
  if (!d.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='tasks'").get()) return; // brand-new database: nothing to protect
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"), prefix = `${path.basename(file)}.pre-upgrade-`;
  try {
    d.prepare("VACUUM INTO ?").run(path.join(path.dirname(file), `${prefix}v${v}-${stamp}-${process.pid}`));
    const old = fs.readdirSync(path.dirname(file)).filter((f) => f.startsWith(prefix)).sort().reverse().slice(3);
    for (const f of old) try { fs.unlinkSync(path.join(path.dirname(file), f)); } catch { /* best effort */ }
  } catch (e) { throw new Error(`LifeOS could not save a safety copy before upgrading the database (${(e as Error).message}). Free some disk space, or set LIFEOS_SKIP_UPGRADE_BACKUP=1 to upgrade without one.`); }
}

const g = globalThis as unknown as { __db?: Database.Database };
export const db = (g.__db ??= (() => {
  const d = new Database(file);
  d.pragma("busy_timeout = 15000"); // web app, worker and MCP server (and parallel build workers) share this file
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  // Exclusive lock for the whole migration: when several processes start at once on a new database (e.g. `next build`
  // workers, or web + worker + mcp booting together) the others wait, then see the finished schema instead of racing on ALTER TABLE.
  safetyCopy(d);
  d.transaction(() => { migrate(d); d.pragma(`user_version = ${SCHEMA_VERSION}`); }).immediate();
  return d;
})());

export type Project = { id: number; name: string; color: string; archived: number; icon: string; area: string; default_view: string; position: number };
