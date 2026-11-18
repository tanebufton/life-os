import { db } from "./db";
import { addDays, addMonths, weekday } from "./dates";
import { describeRepeat, normalizeRepeat, parseQuickAdd as parseQuick } from "./parse";
import { localDate, today } from "./time";
export { describeRepeat, normalizeRepeat };

export type Status = "todo" | "doing" | "done";
export type TaskRow = {
  id: number; title: string; notes: string; project_id: number | null; priority: number;
  due: string | null; done_at: string | null; status: Status; repeat: string | null;
  project_name: string | null; project_color: string | null; tags: string[];
};
export type NewTask = {
  title: string; notes?: string; project_id?: number | null; project?: string; due?: string | null;
  priority?: number; tags?: string[]; repeat?: string | null; status?: Status;
};

const SELECT = `SELECT t.*, p.name AS project_name, p.color AS project_color,
  (SELECT group_concat(g.name, ',') FROM task_tags tt JOIN tags g ON g.id=tt.tag_id WHERE tt.task_id=t.id) AS tags
  FROM tasks t LEFT JOIN projects p ON p.id=t.project_id`;
type Raw = Omit<TaskRow, "tags"> & { tags: string | null };
const hydrate = (r: Raw): TaskRow => ({ ...r, tags: r.tags ? r.tags.split(",") : [] });

export type Filter = { project?: number; tag?: string; state?: "open" | "done" | "all"; status?: Status; dueBy?: string; inbox?: boolean; limit?: number };
export function queryTasks(f: Filter = {}): TaskRow[] {
  const w: string[] = [], a: unknown[] = [];
  const state = f.state ?? "open";
  if (state === "open") w.push("t.done_at IS NULL"); else if (state === "done") w.push("t.done_at IS NOT NULL");
  if (f.status) { w.push("t.status=?"); a.push(f.status); }
  if (f.project) { w.push("t.project_id=?"); a.push(f.project); }
  if (f.tag) { w.push("EXISTS (SELECT 1 FROM task_tags tt JOIN tags g ON g.id=tt.tag_id WHERE tt.task_id=t.id AND g.name=?)"); a.push(cleanTag(f.tag)); }
  if (f.dueBy) { w.push("t.due IS NOT NULL AND t.due<=?"); a.push(f.dueBy); }
  if (f.inbox) w.push("t.project_id IS NULL AND t.due IS NULL");
  const order = state === "done" ? "t.done_at DESC, t.id DESC" : "t.done_at IS NOT NULL, t.priority DESC, t.due IS NULL, t.due, t.id";
  const sql = `${SELECT} ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY ${order} LIMIT ?`;
  return (db.prepare(sql).all(...a, f.limit ?? 500) as Raw[]).map(hydrate);
}
export const getTask = (id: number): TaskRow | undefined => {
  const r = db.prepare(`${SELECT} WHERE t.id=?`).get(id) as Raw | undefined;
  return r && hydrate(r);
};

// ---------- tags ----------
export const cleanTag = (s: string) =>
  s.trim().replace(/^#/, "").toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "");
export const parseTags = (s: string) => [...new Set(s.split(/[\s,]+/).map(cleanTag).filter(Boolean))];
export function setTaskTags(id: number, names: string[]) {
  const clean = [...new Set(names.map(cleanTag).filter(Boolean))];
  db.transaction(() => {
    db.prepare("DELETE FROM task_tags WHERE task_id=?").run(id);
    for (const n of clean) {
      db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(n);
      const t = db.prepare("SELECT id FROM tags WHERE name=?").get(n) as { id: number };
      db.prepare("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?,?)").run(id, t.id);
    }
  })();
}
export const listTags = () =>
  db.prepare(`SELECT g.name, COUNT(t.id) AS open FROM tags g
    JOIN task_tags tt ON tt.tag_id=g.id JOIN tasks t ON t.id=tt.task_id AND t.done_at IS NULL
    GROUP BY g.id ORDER BY open DESC, g.name`).all() as { name: string; open: number }[];

// ---------- projects ----------
export function projectByName(name?: string | null): number | null {
  if (!name?.trim()) return null;
  const n = name.trim().toLowerCase();
  const p = db.prepare("SELECT id FROM projects WHERE archived=0 AND (lower(name)=? OR replace(lower(name),' ','-')=?)").get(n, n) as { id: number } | undefined;
  return p ? p.id : Number(db.prepare("INSERT INTO projects (name) VALUES (?)").run(name.trim()).lastInsertRowid);
}

// ---------- repeats ----------
function step(d: string, r: string): string {
  if (r === "weekdays") { let n = addDays(d, 1); while ([0, 6].includes(weekday(n))) n = addDays(n, 1); return n; }
  const n = parseInt(r), u = r.slice(-1);
  return u === "d" ? addDays(d, n) : u === "w" ? addDays(d, 7 * n) : u === "m" ? addMonths(d, n) : addMonths(d, 12 * n);
}
/** Next occurrence strictly after today (overdue repeats skip forward rather than piling up). */
export function nextDue(due: string | null, r: string): string {
  const t = today();
  let d = due ?? t;
  do { d = step(d, r); } while (d <= t);
  return d;
}

// ---------- mutations ----------
export function createTask(n: NewTask): number {
  const rep = normalizeRepeat(n.repeat);
  const pid = n.project_id ?? projectByName(n.project);
  const due = n.due === undefined ? (rep ? today() : null) : n.due;
  const status = n.status && n.status !== "done" ? n.status : "todo";
  const id = Number(db.prepare("INSERT INTO tasks (title,notes,project_id,due,priority,repeat,status) VALUES (?,?,?,?,?,?,?)")
    .run(n.title.trim(), n.notes ?? "", pid, due, n.priority ?? 0, rep, status).lastInsertRowid);
  if (n.tags?.length) setTaskTags(id, n.tags);
  return id;
}

export function completeTask(id: number): { id: number; next_due?: string } | null {
  const t = getTask(id);
  if (!t) return null;
  if (t.done_at) return { id };
  if (t.repeat) {
    const next = db.transaction(() => {
      const h = db.prepare("INSERT INTO tasks (title,notes,project_id,priority,due,status,done_at) VALUES (?,?,?,?,?,'done',datetime('now'))")
        .run(t.title, t.notes, t.project_id, t.priority, t.due);
      db.prepare("INSERT INTO task_tags (task_id, tag_id) SELECT ?, tag_id FROM task_tags WHERE task_id=?").run(h.lastInsertRowid, id);
      const nd = nextDue(t.due, t.repeat!);
      db.prepare("UPDATE tasks SET due=?, status='todo' WHERE id=?").run(nd, id);
      return nd;
    })();
    return { id, next_due: next };
  }
  db.prepare("UPDATE tasks SET done_at=datetime('now'), status='done' WHERE id=?").run(id);
  return { id };
}
export const reopenTask = (id: number) => db.prepare("UPDATE tasks SET done_at=NULL, status='todo' WHERE id=?").run(id).changes > 0;
export function setStatus(id: number, status: Status) {
  if (status === "done") return completeTask(id);
  const r = db.prepare("UPDATE tasks SET status=?, done_at=NULL WHERE id=?").run(status, id);
  return r.changes ? { id } : null;
}
export const deleteTask = (id: number) => db.prepare("DELETE FROM tasks WHERE id=?").run(id).changes > 0;

export type Patch = Partial<Omit<NewTask, "project_id">> & { project_id?: number | null };
export function updateTask(id: number, p: Patch): boolean {
  if (!getTask(id)) return false;
  const sets: string[] = [], a: unknown[] = [];
  const set = (c: string, v: unknown) => { sets.push(`${c}=?`); a.push(v); };
  if (p.title !== undefined) set("title", p.title.trim());
  if (p.notes !== undefined) set("notes", p.notes);
  if (p.project !== undefined) set("project_id", projectByName(p.project));
  if (p.project_id !== undefined) set("project_id", p.project_id);
  if (p.due !== undefined) set("due", p.due);
  if (p.priority !== undefined) set("priority", p.priority);
  if (p.repeat !== undefined) set("repeat", normalizeRepeat(p.repeat));
  db.transaction(() => {
    if (sets.length) db.prepare(`UPDATE tasks SET ${sets.join(",")} WHERE id=?`).run(...a, id);
    if (p.tags) setTaskTags(id, p.tags);
    if (p.status) setStatus(id, p.status);
  })();
  return true;
}

export function doneToday(): number {
  const t = today();
  return (db.prepare("SELECT done_at FROM tasks WHERE done_at >= datetime('now','-2 days')").all() as { done_at: string }[])
    .filter((r) => localDate(r.done_at) === t).length;
}

// ---------- quick add ----------
export function parseQuickAdd(input: string): NewTask {
  const p = parseQuick(input, today());
  if (!p.title) throw new Error("Task title is empty");
  return p;
}
