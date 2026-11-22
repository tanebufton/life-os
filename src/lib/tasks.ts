import { db } from "./db";
import { addDays, addMonths, weekday } from "./dates";
import { describeRepeat, normalizeRepeat, repeatLabel, parseQuickAdd as parseQuick } from "./parse";
import { localDate, today } from "./time";
import { record, recordDiff } from "./activity";
import { defaultColumn, kindOf, listStatuses, remapTaskStatus, resolveStatus, type Kind } from "./statuses";
export { describeRepeat, normalizeRepeat, repeatLabel };

/** A column key. The default columns use "todo", "doing" and "done"; projects can have their own. */
export type Status = string;
export type TaskRow = {
  id: number; title: string; notes: string; project_id: number | null; priority: number;
  due: string | null; due_time: string | null; estimate: number | null; done_at: string | null; status: Status; repeat: string | null;
  parent_id: number | null; source: string; meta: string | null; deleted_at: string | null;
  status_kind: Kind; status_name: string; position: number | null; project_name: string | null; project_color: string | null; tags: string[]; sub_total: number; sub_done: number; att_total: number;
};
export type NewTask = {
  title: string; notes?: string; project_id?: number | null; project?: string; due?: string | null; due_time?: string | null; estimate?: number | null;
  priority?: number; tags?: string[]; repeat?: string | null; status?: Status; parent_id?: number | null; source?: string; meta?: object | null;
};

const SELECT = `SELECT t.*, p.name AS project_name, p.color AS project_color,
  COALESCE(st.kind, CASE t.status WHEN 'done' THEN 'done' WHEN 'doing' THEN 'doing' ELSE 'todo' END) AS status_kind, COALESCE(st.name, t.status) AS status_name,
  (SELECT group_concat(g.name, ',') FROM task_tags tt JOIN tags g ON g.id=tt.tag_id WHERE tt.task_id=t.id) AS tags,
  (SELECT count(*) FROM tasks s WHERE s.parent_id=t.id AND s.deleted_at IS NULL) AS sub_total, (SELECT count(*) FROM attachments a WHERE a.task_id=t.id) AS att_total,
  (SELECT count(*) FROM tasks s WHERE s.parent_id=t.id AND s.deleted_at IS NULL AND s.done_at IS NOT NULL) AS sub_done
  FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN statuses st ON st.key=t.status`;
type Raw = Omit<TaskRow, "tags"> & { tags: string | null };
const hydrate = (r: Raw): TaskRow => ({ ...r, tags: r.tags ? r.tags.split(",") : [] });

export type Filter = {
  project?: number; tag?: string; state?: "open" | "done" | "all"; status?: Status; dueBy?: string; dueOn?: string; inbox?: boolean; limit?: number;
  parent?: number; includeSub?: boolean; source?: string; since?: string;
};
export function queryTasks(f: Filter = {}): TaskRow[] {
  const w: string[] = ["t.deleted_at IS NULL"], a: unknown[] = [];
  const state = f.state ?? "open";
  if (state === "open") w.push("t.done_at IS NULL"); else if (state === "done") w.push("t.done_at IS NOT NULL");
  if (f.parent) { w.push("t.parent_id=?"); a.push(f.parent); } else if (!f.includeSub) w.push("t.parent_id IS NULL");
  if (f.status) { if (["todo", "doing", "done"].includes(f.status)) { w.push("t.status IN (SELECT key FROM statuses WHERE kind=?)"); a.push(f.status); } else { w.push("t.status=?"); a.push(f.status); } }
  if (f.project) { w.push("t.project_id=?"); a.push(f.project); }
  if (f.source) { w.push("t.source=?"); a.push(f.source); }
  if (f.tag) { w.push("EXISTS (SELECT 1 FROM task_tags tt JOIN tags g ON g.id=tt.tag_id WHERE tt.task_id=t.id AND g.name=?)"); a.push(cleanTag(f.tag)); }
  if (f.dueBy) { w.push("t.due IS NOT NULL AND t.due<=?"); a.push(f.dueBy); }
  if (f.dueOn) { w.push("t.due=?"); a.push(f.dueOn); }
  if (f.since) { w.push("t.done_at >= ?"); a.push(f.since); }
  if (f.inbox) w.push("t.project_id IS NULL AND t.due IS NULL");
  const order = state === "done" ? "t.done_at DESC, t.id DESC" : "t.done_at IS NOT NULL, t.priority DESC, t.due IS NULL, t.due, t.due_time IS NULL, t.due_time, t.id";
  const sql = `${SELECT} WHERE ${w.join(" AND ")} ORDER BY ${order} LIMIT ?`;
  return (db.prepare(sql).all(...a, f.limit ?? 500) as Raw[]).map(hydrate);
}
export const getTask = (id: number, withDeleted = false): TaskRow | undefined => {
  const r = db.prepare(`${SELECT} WHERE t.id=? ${withDeleted ? "" : "AND t.deleted_at IS NULL"}`).get(id) as Raw | undefined;
  return r && hydrate(r);
};
export const subtasks = (id: number) => queryTasks({ parent: id, state: "all" }).sort((a, b) => a.id - b.id);

// ---------- tags ----------
/** A tag keeps the capital letters you typed. Matching ignores case (the tags table is NOCASE), so "Work" and "work" are one tag. */
export const cleanTag = (s: string) =>
  s.trim().replace(/^#/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "");
/** Drop repeats that differ only by case, keeping the first spelling. */
export const uniqueTags = (names: string[]) => { const seen = new Set<string>(), out: string[] = []; for (const n of names) { const k = n.toLowerCase(); if (n && !seen.has(k)) { seen.add(k); out.push(n); } } return out; };
export const parseTags = (s: string) => uniqueTags(s.split(/[\s,]+/).map(cleanTag));
/** Find or create a tag. When `adopt` is set (you typed it in a tags field) and it exists in a different case, it takes the case you typed. */
export function ensureTag(name: string, adopt = false): number {
  db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(name);
  const row = db.prepare("SELECT id, name FROM tags WHERE name=?").get(name) as { id: number; name: string };
  if (adopt && row.name !== name) db.prepare("UPDATE tags SET name=? WHERE id=?").run(name, row.id);
  return row.id;
}
export function setTaskTags(id: number, names: string[], adopt = false) {
  const clean = uniqueTags(names.map(cleanTag));
  db.transaction(() => {
    db.prepare("DELETE FROM task_tags WHERE task_id=?").run(id);
    for (const n of clean) {
      db.prepare("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?,?)").run(id, ensureTag(n, adopt));
    }
  })();
}
export const listTags = () =>
  db.prepare(`SELECT g.name, COUNT(t.id) AS open FROM tags g
    JOIN task_tags tt ON tt.tag_id=g.id JOIN tasks t ON t.id=tt.task_id AND t.done_at IS NULL AND t.deleted_at IS NULL
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
/** Next occurrence strictly after today (overdue repeats skip forward, no pile-up). */
export function nextDue(due: string | null, r: string): string {
  const t = today();
  let d = due ?? t;
  do { d = step(d, r); } while (d <= t);
  return d;
}

/** Manual order: tasks that have been dragged come first, in the order set; the rest follow in their usual order. */
export const byPosition = <T extends { position: number | null }>(list: T[]): T[] => [...list].sort((a, b) => (a.position === null ? 1 : 0) - (b.position === null ? 1 : 0) || (a.position ?? 0) - (b.position ?? 0));
/** Save a manual order for these tasks (first in the list = first on screen). */
export function setTaskOrder(ids: number[]) {
  const clean = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000), up = db.prepare("UPDATE tasks SET position=? WHERE id=? AND deleted_at IS NULL");
  db.transaction(() => clean.forEach((id, i) => up.run((i + 1) * 1024, id)))();
}
/** Move a card into a column and place it in the given order. Moving to a different column also changes its status (and may complete it). */
export function moveCard(id: number, columnKey: string, ordered: number[]) {
  const t = getTask(id); if (!t) return;
  if (t.status !== columnKey) setStatus(id, columnKey);
  setTaskOrder(ordered.includes(id) ? ordered : [...ordered, id]);
}
// ---------- mutations ----------
export function createTask(n: NewTask): number {
  const rep = normalizeRepeat(n.repeat);
  const parent = n.parent_id ? getTask(n.parent_id) : undefined;
  const pid = n.project_id ?? projectByName(n.project) ?? parent?.project_id ?? null;
  const due = n.due === undefined ? (rep || n.due_time ? today() : null) : n.due; // a time or a repeat with no date means today
  const asked = n.status ? resolveStatus(pid, n.status) : null, status = (asked && asked.kind !== "done" ? asked : defaultColumn(pid, "todo")).key; // new tasks are never created finished
  const id = Number(db.prepare("INSERT INTO tasks (title,notes,project_id,due,due_time,estimate,priority,repeat,status,parent_id,source,meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(n.title.trim(), n.notes ?? "", pid, due, n.due_time ?? null, n.estimate ?? null, n.priority ?? 0, rep, status, n.parent_id ?? null, n.source ?? "manual", n.meta ? JSON.stringify(n.meta) : null).lastInsertRowid);
  if (n.tags?.length) setTaskTags(id, n.tags);
  record("task", id, "created", { new: n.title });
  return id;
}

export function completeTask(id: number, doneKey?: string): { id: number; next_due?: string } | null {
  const t = getTask(id);
  if (!t) return null;
  if (t.done_at) return { id };
  const doneCol = (doneKey && resolveStatus(t.project_id, doneKey)?.kind === "done" ? resolveStatus(t.project_id, doneKey)! : defaultColumn(t.project_id, "done")).key, first = listStatuses(t.project_id)[0], todoCol = (first && first.kind !== "done" ? first : defaultColumn(t.project_id, "todo")).key; // the next occurrence starts in the far-left column
  if (t.repeat) {
    const next = db.transaction(() => {
      const h = db.prepare("INSERT INTO tasks (title,notes,project_id,priority,due,due_time,estimate,status,done_at,source) VALUES (?,?,?,?,?,?,?,?, datetime('now'), ?)")
        .run(t.title, t.notes, t.project_id, t.priority, t.due, t.due_time, t.estimate, doneCol, t.source);
      db.prepare("INSERT INTO task_tags (task_id, tag_id) SELECT ?, tag_id FROM task_tags WHERE task_id=?").run(h.lastInsertRowid, id);
      const nd = nextDue(t.due, t.repeat!);
      db.prepare("UPDATE tasks SET due=?, status=? WHERE id=?").run(nd, todoCol, id);
      db.prepare("UPDATE tasks SET done_at=NULL, status=? WHERE parent_id=?").run(todoCol, id); // recurring checklists reset
      return nd;
    })();
    record("task", id, "completed"); record("task", id, "changed", { field: "Due", old: t.due, new: next });
    return { id, next_due: next };
  }
  db.transaction(() => {
    db.prepare("UPDATE tasks SET done_at=datetime('now'), status=? WHERE id=?").run(doneCol, id);
    db.prepare("UPDATE tasks SET done_at=datetime('now'), status=? WHERE parent_id=? AND done_at IS NULL AND deleted_at IS NULL").run(defaultColumn(t.project_id, "done").key, id);
  })();
  record("task", id, "completed");
  return { id };
}
export function reopenTask(id: number): boolean { const t = getTask(id); if (!t) return false; const ok = db.prepare("UPDATE tasks SET done_at=NULL, status=? WHERE id=?").run(defaultColumn(t.project_id, "todo").key, id).changes > 0; if (ok) record("task", id, "reopened"); return ok; }
/** Move a task to a column. `status` is a column key or name, or the words todo / doing / done. Landing in a done-kind column completes it (a repeating task rolls to its next date instead). */
export function setStatus(id: number, status: Status) {
  const t = getTask(id); if (!t) return null;
  const col = resolveStatus(t.project_id, status); if (!col) throw new Error(`There is no column "${status}" here`);
  if (col.kind === "done") return completeTask(id, col.key);
  const r = db.prepare("UPDATE tasks SET status=?, done_at=NULL WHERE id=?").run(col.key, id);
  if (r.changes && (t.status !== col.key || t.done_at)) record("task", id, "changed", { field: "Status", old: t.status_name, new: col.name });
  return r.changes ? { id } : null;
}
/** Soft delete (children too). Recoverable for 30 days via restoreTask. */
export function deleteTask(id: number): boolean {
  return db.transaction(() => {
    const r = db.prepare("UPDATE tasks SET deleted_at=datetime('now') WHERE id=? AND deleted_at IS NULL").run(id);
    db.prepare("UPDATE tasks SET deleted_at=datetime('now') WHERE parent_id=? AND deleted_at IS NULL").run(id);
    if (r.changes) record("task", id, "deleted");
    return r.changes > 0;
  })();
}
export function restoreTask(id: number): boolean {
  return db.transaction(() => {
    const r = db.prepare("UPDATE tasks SET deleted_at=NULL WHERE id=? AND deleted_at IS NOT NULL").run(id);
    db.prepare("UPDATE tasks SET deleted_at=NULL WHERE parent_id=?").run(id);
    if (r.changes) record("task", id, "restored");
    return r.changes > 0;
  })();
}
export function duplicateTask(id: number): number | null {
  const t = getTask(id);
  if (!t) return null;
  const copy = (src: TaskRow, parent?: number) => createTask({ title: src.title, notes: src.notes, project_id: src.project_id, due: src.due, due_time: src.due_time, estimate: src.estimate,
    priority: src.priority, tags: src.tags, repeat: src.repeat, parent_id: parent, source: "manual" });
  return db.transaction(() => { const nid = copy(t); for (const s of subtasks(id)) copy(s, nid); return nid; })();
}

export type Patch = Partial<Omit<NewTask, "project_id" | "meta" | "source">> & { project_id?: number | null };
export function updateTask(id: number, p: Patch): boolean {
  const before = getTask(id);
  if (!before) return false;
  const sets: string[] = [], a: unknown[] = [];
  const set = (c: string, v: unknown) => { sets.push(`${c}=?`); a.push(v); };
  if (p.title !== undefined) set("title", p.title.trim());
  if (p.notes !== undefined) set("notes", p.notes);
  if (p.project !== undefined) set("project_id", projectByName(p.project));
  if (p.project_id !== undefined) set("project_id", p.project_id);
  if (p.due !== undefined) set("due", p.due);
  if (p.due_time !== undefined) set("due_time", p.due_time || null);
  if (p.estimate !== undefined) set("estimate", p.estimate || null);
  if (p.priority !== undefined) set("priority", p.priority);
  if (p.repeat !== undefined) set("repeat", normalizeRepeat(p.repeat));
  db.transaction(() => {
    if (sets.length) db.prepare(`UPDATE tasks SET ${sets.join(",")} WHERE id=?`).run(...a, id);
    if (p.project !== undefined || p.project_id !== undefined) remapTaskStatus(id); // a task moved to another project lands in the matching column there
    if (p.tags) setTaskTags(id, p.tags, true);
    if (p.status) setStatus(id, p.status);
    const after = getTask(id)!;
    recordDiff("task", id, { ...before, tags: before.tags.join(" ") }, { ...after, tags: after.tags.join(" ") }, { title: "Title", project_name: "Project", due: "Due", due_time: "Time", estimate: "Estimate", priority: "Priority", repeat: "Repeat", tags: "Tags" });
    if (before.notes !== after.notes) record("task", id, "edited", { field: "notes", old: `${before.notes.length} chars`, new: `${after.notes.length} chars` });
  })();
  return true;
}

// ---------- quick reschedule ----------
export type Preset = "today" | "tomorrow" | "weekend" | "nextweek" | "none";
export function presetDate(p: Preset, t = today()): string | null {
  switch (p) {
    case "today": return t;
    case "tomorrow": return addDays(t, 1);
    case "weekend": return addDays(t, ((6 - weekday(t) + 7) % 7) || 7);
    case "nextweek": return addDays(t, ((1 - weekday(t) + 7) % 7) || 7);
    default: return null;
  }
}
export function reschedule(id: number, to: Preset | string): boolean {
  const due = ["today", "tomorrow", "weekend", "nextweek", "none"].includes(to) ? presetDate(to as Preset) : /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined;
  if (due === undefined) throw new Error(`Invalid date "${to}"`);
  const prev = db.prepare("SELECT due FROM tasks WHERE id=?").get(id) as { due: string | null } | undefined;
  const ok = db.prepare("UPDATE tasks SET due=? WHERE id=? AND deleted_at IS NULL").run(due, id).changes > 0;
  if (ok && (prev?.due ?? null) !== due) record("task", id, "changed", { field: "Due", old: prev?.due, new: due });
  return ok;
}

export function doneToday(): number {
  const t = today();
  return (db.prepare("SELECT done_at FROM tasks WHERE done_at >= datetime('now','-2 days') AND deleted_at IS NULL").all() as { done_at: string }[])
    .filter((r) => localDate(r.done_at) === t).length;
}
export const openCount = () => (db.prepare("SELECT count(*) n FROM tasks WHERE done_at IS NULL AND deleted_at IS NULL AND parent_id IS NULL").get() as { n: number }).n;

// ---------- quick add ----------
export function parseQuickAdd(input: string): NewTask {
  const p = parseQuick(input, today());
  if (!p.title) throw new Error("Task title is empty");
  return p;
}

// ---------- search: "invoice #bills @home due:week is:any no:date has:subtasks" ----------
const esc = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);
export function searchTasks(q: string, limit = 50): TaskRow[] {
  const w: string[] = ["t.deleted_at IS NULL"], a: unknown[] = [];
  let state: "open" | "done" | "any" = "open";
  const t = today();
  for (const tok of q.trim().split(/\s+/).filter(Boolean)) {
    const low = tok.toLowerCase();
    let m: RegExpMatchArray | null;
    if ((m = tok.match(/^#(.+)$/))) { w.push("EXISTS (SELECT 1 FROM task_tags tt JOIN tags g ON g.id=tt.tag_id WHERE tt.task_id=t.id AND g.name=?)"); a.push(cleanTag(m[1])); }
    else if ((m = tok.match(/^@(.+)$/))) { w.push("(lower(p.name)=? OR replace(lower(p.name),' ','-')=?)"); a.push(m[1].toLowerCase(), m[1].toLowerCase()); }
    else if (low === "!high" || low === "priority:high") w.push("t.priority>0");
    else if (low === "!low" || low === "priority:low") w.push("t.priority<0");
    else if ((m = low.match(/^is:(open|done|any|doing|todo|recurring|overdue)$/))) {
      if (m[1] === "open" || m[1] === "done" || m[1] === "any") state = m[1];
      else if (m[1] === "recurring") w.push("t.repeat IS NOT NULL");
      else if (m[1] === "overdue") { w.push("t.due < ?"); a.push(t); }
      else { w.push("t.status IN (SELECT key FROM statuses WHERE kind=?)"); a.push(m[1]); }
    }
    else if ((m = low.match(/^due:(.+)$/))) {
      const v = m[1];
      if (v === "today") { w.push("t.due=?"); a.push(t); }
      else if (v === "tomorrow") { w.push("t.due=?"); a.push(addDays(t, 1)); }
      else if (v === "overdue") { w.push("t.due<?"); a.push(t); }
      else if (v === "week") { w.push("t.due BETWEEN ? AND ?"); a.push(t, addDays(t, 7)); }
      else if (v === "none") w.push("t.due IS NULL");
      else if (v === "any") w.push("t.due IS NOT NULL");
      else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { w.push("t.due=?"); a.push(v); }
    }
    else if ((m = low.match(/^(before|after):(\d{4}-\d{2}-\d{2})$/))) { w.push(m[1] === "before" ? "t.due<?" : "t.due>?"); a.push(m[2]); }
    else if ((m = low.match(/^no:(date|project|tag)$/))) w.push(m[1] === "date" ? "t.due IS NULL" : m[1] === "project" ? "t.project_id IS NULL" : "NOT EXISTS (SELECT 1 FROM task_tags x WHERE x.task_id=t.id)");
    else if ((m = low.match(/^has:(subtasks|notes|link|time|estimate)$/))) w.push({ subtasks: "(SELECT count(*) FROM tasks s WHERE s.parent_id=t.id AND s.deleted_at IS NULL)>0", notes: "t.notes!=''", link: "(t.notes LIKE '%http%' OR t.title LIKE '%http%')", time: "t.due_time IS NOT NULL", estimate: "t.estimate IS NOT NULL" }[m[1]]!);
    else if ((m = low.match(/^source:(\w+)$/))) { w.push("t.source=?"); a.push(m[1]); }
    else { w.push("(t.title LIKE ? ESCAPE '\\' OR t.notes LIKE ? ESCAPE '\\')"); a.push(`%${esc(tok)}%`, `%${esc(tok)}%`); }
  }
  if (state === "open") w.push("t.done_at IS NULL"); else if (state === "done") w.push("t.done_at IS NOT NULL");
  const sql = `${SELECT} WHERE ${w.join(" AND ")} ORDER BY t.done_at IS NOT NULL, t.priority DESC, t.due IS NULL, t.due, t.id LIMIT ?`;
  return (db.prepare(sql).all(...a, limit) as Raw[]).map(hydrate);
}
