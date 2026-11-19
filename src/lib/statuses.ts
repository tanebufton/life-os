import { db } from "./db";

export type Kind = "todo" | "doing" | "done";
export type StatusRow = { id: number; project_id: number | null; key: string; name: string; kind: Kind; position: number };
export const KINDS: Kind[] = ["todo", "doing", "done"];
export const MAX_COLUMNS = 12;
const BASE_NAMES: Record<string, Kind> = { todo: "todo", "to do": "todo", open: "todo", doing: "doing", "in progress": "doing", "in-progress": "doing", done: "done", complete: "done", completed: "done" };
const rows = (pid: number | null) => (pid === null ? db.prepare("SELECT * FROM statuses WHERE project_id IS NULL ORDER BY position, id") : db.prepare("SELECT * FROM statuses WHERE project_id=? ORDER BY position, id")).all(...(pid === null ? [] : [pid])) as StatusRow[];

/** The default board columns must always exist. Called after anything that can replace the table (e.g. restoring a backup from before columns existed). */
export function ensureDefaultStatuses() {
  if (db.prepare("SELECT 1 FROM statuses WHERE project_id IS NULL LIMIT 1").get()) return;
  const ins = db.prepare("INSERT INTO statuses (project_id, key, name, kind, position) VALUES (NULL, ?, ?, ?, ?)");
  ins.run("todo", "To do", "todo", 0); ins.run("doing", "In progress", "doing", 1); ins.run("done", "Done", "done", 2);
}
export const hasCustomColumns = (pid: number | null) => pid !== null && !!db.prepare("SELECT 1 FROM statuses WHERE project_id=? LIMIT 1").get(pid);
/** The columns a task in this project uses: the project's own set if it has one, else the default set. */
export const listStatuses = (pid: number | null = null): StatusRow[] => (hasCustomColumns(pid) ? rows(pid) : rows(null));
export const getStatus = (id: number) => db.prepare("SELECT * FROM statuses WHERE id=?").get(id) as StatusRow | undefined;
export const statusByKey = (key: string) => db.prepare("SELECT * FROM statuses WHERE key=?").get(key) as StatusRow | undefined;
export const kindOf = (key: string): Kind => statusByKey(key)?.kind ?? (key === "done" ? "done" : key === "doing" ? "doing" : "todo");
/** First column of a kind in this project's set. A set may have no "doing" column; then work-in-progress falls back to the first to-do column. */
export function defaultColumn(pid: number | null, kind: Kind): StatusRow {
  const set = listStatuses(pid); return set.find((s) => s.kind === kind) ?? (kind === "done" ? set[set.length - 1] : set[0]);
}
/** Accepts a column key, its name, or one of the words todo / doing / done (so the API and bots keep working with custom columns). */
export function resolveStatus(pid: number | null, input: string): StatusRow | null {
  const q = input.trim().toLowerCase(), set = listStatuses(pid);
  return set.find((s) => s.key === q) ?? set.find((s) => s.name.toLowerCase() === q) ?? (BASE_NAMES[q] ? defaultColumn(pid, BASE_NAMES[q]) : null);
}

// ---------- editing a set ----------
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "col";
function newKey(name: string): string { const b = slug(name); let k = b, i = 2; while (statusByKey(k)) k = `${b}-${i++}`; return k; }
const cleanName = (n: string) => { const s = n.replace(/\s+/g, " ").trim(); if (!s) throw new Error("A column needs a name"); if (s.length > 30) throw new Error("Keep column names under 30 characters"); return s; };
function checkSet(set: { kind: Kind }[]) {
  if (set.length > MAX_COLUMNS) throw new Error(`At most ${MAX_COLUMNS} columns`);
  if (!set.some((s) => s.kind === "todo")) throw new Error("Keep at least one \"To do\" column, so new tasks have somewhere to start");
  if (!set.some((s) => s.kind === "done")) throw new Error("Keep at least one \"Done\" column, so tasks can be finished");
}
const scopeRows = (s: StatusRow) => rows(s.project_id);
const dup = (set: StatusRow[], name: string, exceptId = 0) => { if (set.some((x) => x.id !== exceptId && x.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already a column called "${name}"`); };
/** Keep done_at consistent with the column a task sits in. */
function syncDone(key: string, kind: Kind) { db.prepare(kind === "done" ? "UPDATE tasks SET done_at=COALESCE(done_at, datetime('now')) WHERE status=?" : "UPDATE tasks SET done_at=NULL WHERE status=?").run(key); }

export function addColumn(pid: number | null, name: string, kind: Kind): StatusRow {
  if (pid !== null && !hasCustomColumns(pid)) throw new Error("Turn on this project's own columns first");
  const n = cleanName(name); if (!KINDS.includes(kind)) throw new Error("Pick To do, In progress or Done");
  const set = rows(pid); dup(set, n); checkSet([...set, { kind }]);
  // New columns go just before the first "done" column unless they are themselves done-kind
  const at = kind === "done" ? set.length : (set.findIndex((s) => s.kind === "done") + 1 || set.length + 1) - 1;
  return db.transaction(() => {
    db.prepare("UPDATE statuses SET position=position+1 WHERE project_id IS ? AND position>=?").run(pid, at);
    const id = Number(db.prepare("INSERT INTO statuses (project_id, key, name, kind, position) VALUES (?,?,?,?,?)").run(pid, newKey(n), n, kind, at).lastInsertRowid);
    return getStatus(id)!;
  })();
}
export function renameColumn(id: number, name: string) { const s = getStatus(id); if (!s) throw new Error("No such column"); const n = cleanName(name); dup(scopeRows(s), n, id); db.prepare("UPDATE statuses SET name=? WHERE id=?").run(n, id); }
export function setColumnKind(id: number, kind: Kind) {
  const s = getStatus(id); if (!s) throw new Error("No such column"); if (!KINDS.includes(kind)) throw new Error("Bad kind");
  checkSet(scopeRows(s).map((x) => (x.id === id ? { kind } : x)));
  db.transaction(() => { db.prepare("UPDATE statuses SET kind=? WHERE id=?").run(kind, id); syncDone(s.key, kind); })();
}
export function moveColumn(id: number, dir: -1 | 1) {
  const s = getStatus(id); if (!s) throw new Error("No such column"); const set = scopeRows(s), i = set.findIndex((x) => x.id === id), j = i + dir;
  if (j < 0 || j >= set.length) return;
  db.transaction(() => { set.splice(j, 0, set.splice(i, 1)[0]); set.forEach((x, k) => db.prepare("UPDATE statuses SET position=? WHERE id=?").run(k, x.id)); })();
}
/** Delete a column. Its tasks move to `moveToId` (default: the nearest column of the same kind, else the first to-do). */
export function deleteColumn(id: number, moveToId?: number): { moved: number } {
  const s = getStatus(id); if (!s) throw new Error("No such column"); const set = scopeRows(s);
  checkSet(set.filter((x) => x.id !== id));
  const target = (moveToId ? set.find((x) => x.id === moveToId && x.id !== id) : undefined) ?? set.find((x) => x.id !== id && x.kind === s.kind) ?? set.find((x) => x.id !== id && x.kind === "todo")!;
  return db.transaction(() => {
    const moved = db.prepare("UPDATE tasks SET status=? WHERE status=?").run(target.key, s.key).changes; syncDone(target.key, target.kind);
    db.prepare("DELETE FROM statuses WHERE id=?").run(id); set.filter((x) => x.id !== id).forEach((x, k) => db.prepare("UPDATE statuses SET position=? WHERE id=?").run(k, x.id));
    return { moved };
  })();
}
/** Give a project its own columns, starting as a copy of the default set. Its tasks keep their place (matched by position). */
export function customizeProject(pid: number) {
  if (hasCustomColumns(pid)) return;
  db.transaction(() => {
    for (const g of rows(null)) {
      const key = newKey(`${g.key}-p${pid}`);
      db.prepare("INSERT INTO statuses (project_id, key, name, kind, position) VALUES (?,?,?,?,?)").run(pid, key, g.name, g.kind, g.position);
      db.prepare("UPDATE tasks SET status=? WHERE project_id=? AND status=?").run(key, pid, g.key);
    }
  })();
}
/** Back to the default columns. Tasks go to the default column of the same kind. */
export function resetProject(pid: number) {
  if (!hasCustomColumns(pid)) return;
  db.transaction(() => {
    for (const c of rows(pid)) { const t = defaultColumn(null, c.kind); db.prepare("UPDATE tasks SET status=? WHERE project_id=? AND status=?").run(t.key, pid, c.key); }
    db.prepare("DELETE FROM statuses WHERE project_id=?").run(pid);
  })();
}
/** Make sure a task's status is one of the columns of its (possibly new) project, mapping by kind if not. */
export function remapTaskStatus(taskId: number) {
  const t = db.prepare("SELECT project_id, status FROM tasks WHERE id=?").get(taskId) as { project_id: number | null; status: string } | undefined; if (!t) return;
  if (listStatuses(t.project_id).some((s) => s.key === t.status)) return;
  db.prepare("UPDATE tasks SET status=? WHERE id=?").run(defaultColumn(t.project_id, kindOf(t.status)).key, taskId);
}
