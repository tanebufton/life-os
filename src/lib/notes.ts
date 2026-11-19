import { db } from "./db";

import { record } from "./activity";
export type Note = { rev: number; project_id: number | null; parent_id: number | null; icon: string; id: number; title: string; body: string; pinned: number; created_at: string; updated_at: string };
export const getNote = (id: number) => db.prepare("SELECT * FROM notes WHERE id=? AND deleted_at IS NULL").get(id) as Note | undefined;
export const noteByTitle = (title: string) => db.prepare("SELECT * FROM notes WHERE lower(title)=lower(?) AND deleted_at IS NULL").get(title.trim()) as Note | undefined;
export function listNotes(o: { q?: string; limit?: number; project?: number; ids?: number[] } = {}): Note[] {
  const like = o.q ? `%${o.q.replace(/[\\%_]/g, (c) => "\\" + c)}%` : null, w = ["deleted_at IS NULL"], a: unknown[] = [];
  if (like) { w.push("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')"); a.push(like, like); }
  if (o.project) { w.push("project_id=?"); a.push(o.project); }
  if (o.ids) { if (!o.ids.length) return []; w.push(`id IN (${o.ids.map(() => "?").join(",")})`); a.push(...o.ids); }
  return db.prepare(`SELECT * FROM notes WHERE ${w.join(" AND ")} ORDER BY pinned DESC, updated_at DESC LIMIT ?`).all(...a, o.limit ?? 200) as Note[];
}
export function createNote(title = "", body = "", projectId: number | null = null, parentId: number | null = null): number { const parent = parentId ? getNote(parentId) : undefined; const id = Number(db.prepare("INSERT INTO notes (title, body, project_id, parent_id) VALUES (?,?,?,?)").run(title.trim(), body, projectId ?? parent?.project_id ?? null, parent ? parent.id : null).lastInsertRowid); record("note", id, "created", { new: title }); return id; }
const VERSION_EVERY_MIN = 10, KEEP_VERSIONS = 30;
export function updateNote(id: number, p: { title?: string; body?: string; pinned?: boolean; project_id?: number | null }): boolean {
  const before = db.prepare("SELECT * FROM notes WHERE id=? AND deleted_at IS NULL").get(id) as Note | undefined; if (!before) return false;
  const sets: string[] = ["updated_at=datetime('now')", "rev=rev+1"], a: unknown[] = [];
  const title = p.title !== undefined ? p.title.trim().slice(0, 200) : undefined, body = p.body !== undefined ? p.body.slice(0, 200_000) : undefined;
  if (title !== undefined) { sets.push("title=?"); a.push(title); } if (body !== undefined) { sets.push("body=?"); a.push(body); } if (p.pinned !== undefined) { sets.push("pinned=?"); a.push(p.pinned ? 1 : 0); }
  if (p.project_id !== undefined) { sets.push("project_id=?"); a.push(p.project_id); }
  return db.transaction(() => {
    // Keep the text as it was before this edit, at most once every 10 minutes, so earlier versions can be restored.
    if (body !== undefined && body !== before.body) {
      const last = db.prepare("SELECT (julianday('now') - julianday(at)) * 1440 AS mins FROM note_versions WHERE note_id=? ORDER BY id DESC LIMIT 1").get(id) as { mins: number } | undefined;
      if (before.body.trim() && (!last || last.mins >= VERSION_EVERY_MIN)) { db.prepare("INSERT INTO note_versions (note_id, title, body) VALUES (?,?,?)").run(id, before.title, before.body); db.prepare("DELETE FROM note_versions WHERE note_id=? AND id NOT IN (SELECT id FROM note_versions WHERE note_id=? ORDER BY id DESC LIMIT ?)").run(id, id, KEEP_VERSIONS); }
      const last2 = db.prepare("SELECT action, at, (julianday('now') - julianday(at)) * 1440 AS mins FROM activity WHERE entity='note' AND entity_id=? ORDER BY id DESC LIMIT 1").get(id) as { action: string; mins: number } | undefined;
      if (!(last2 && last2.action === "edited" && last2.mins < 10)) record("note", id, "edited", { field: "text" }); // one entry per editing session, not per keystroke
    }
    if (title !== undefined && title !== before.title) record("note", id, "changed", { field: "Title", old: before.title, new: title });
    if (p.project_id !== undefined && (p.project_id ?? null) !== (before.project_id ?? null)) { const nm = (pid: number | null | undefined) => (pid ? (db.prepare("SELECT name FROM projects WHERE id=?").get(pid) as { name: string } | undefined)?.name : null); record("note", id, "changed", { field: "Project", old: nm(before.project_id), new: nm(p.project_id) }); }
    if (p.pinned !== undefined && !!p.pinned !== !!before.pinned) record("note", id, p.pinned ? "pinned" : "unpinned");
    return db.prepare(`UPDATE notes SET ${sets.join(",")} WHERE id=? AND deleted_at IS NULL`).run(...a, id).changes > 0;
  })();
}
export type SaveResult = { ok: true; rev: number } | { ok: false; conflict: true; current: { title: string; body: string; rev: number; updated_at: string } } | { ok: false; notFound: true };
/**
 * Save with edit-conflict protection. `baseRev` is the revision the editor loaded; if the note has moved on since (another tab or device saved),
 * nothing is overwritten and the current text is returned. `force` overwrites anyway, first keeping what it replaces as a version.
 */
export function saveNote(id: number, p: { title?: string; body?: string; pinned?: boolean; project_id?: number | null }, baseRev?: number, force = false): SaveResult {
  const cur = getNote(id); if (!cur) return { ok: false, notFound: true };
  if (baseRev !== undefined && cur.rev !== baseRev) {
    if (!force) return { ok: false, conflict: true, current: { title: cur.title, body: cur.body, rev: cur.rev, updated_at: cur.updated_at } };
    if (cur.body.trim()) db.prepare("INSERT INTO note_versions (note_id, title, body) VALUES (?,?,?)").run(id, cur.title, cur.body); // keep the other device's text
    record("note", id, "edited", { field: "overwrote changes made elsewhere" });
  }
  updateNote(id, p); return { ok: true, rev: getNote(id)!.rev };
}
export const noteRev = (id: number) => db.prepare("SELECT rev, title, body FROM notes WHERE id=? AND deleted_at IS NULL").get(id) as { rev: number; title: string; body: string } | undefined;
export const noteVersions = (id: number) => db.prepare("SELECT id, title, body, at FROM note_versions WHERE note_id=? ORDER BY id DESC").all(id) as { id: number; title: string; body: string; at: string }[];
/** Put an earlier version back. The current text is itself kept as a version first, so nothing is lost. */
export function restoreNoteVersion(noteId: number, versionId: number): boolean {
  const v = db.prepare("SELECT title, body FROM note_versions WHERE id=? AND note_id=?").get(versionId, noteId) as { title: string; body: string } | undefined, cur = getNote(noteId); if (!v || !cur) return false;
  db.prepare("INSERT INTO note_versions (note_id, title, body) VALUES (?,?,?)").run(noteId, cur.title, cur.body);
  db.prepare("UPDATE notes SET title=?, body=?, updated_at=datetime('now') WHERE id=?").run(v.title, v.body, noteId); record("note", noteId, "edited", { field: "restored an earlier version" }); return true;
}
export const deleteNote = (id: number) => { const ok = db.prepare("UPDATE notes SET deleted_at=datetime('now') WHERE id=?").run(id).changes > 0; if (ok) record("note", id, "deleted"); return ok; };
export const restoreNote = (id: number) => { const ok = db.prepare("UPDATE notes SET deleted_at=NULL WHERE id=?").run(id).changes > 0; if (ok) record("note", id, "restored"); return ok; };
/** Notes that link to this one with [[Title]]. */
export function backlinks(note: Note): Note[] { if (!note.title.trim()) return []; return db.prepare("SELECT * FROM notes WHERE deleted_at IS NULL AND id!=? AND lower(body) LIKE ? ORDER BY updated_at DESC").all(note.id, `%[[${note.title.toLowerCase().replace(/[\\%_]/g, (c) => "\\" + c)}]]%`.replace(/\\/g, "\\")) as Note[]; }
export const resolver = () => { const m = new Map((db.prepare("SELECT id, title FROM notes WHERE deleted_at IS NULL").all() as { id: number; title: string }[]).map((n) => [n.title.toLowerCase(), n.id])); return (t: string) => m.get(t.toLowerCase()) ?? null; };

// ---------- pages and sub-pages ----------
export const noteChildren = (id: number) => db.prepare("SELECT * FROM notes WHERE parent_id=? AND deleted_at IS NULL ORDER BY pinned DESC, title COLLATE NOCASE").all(id) as Note[];
/** From the top-level page down to (not including) this note. */
export function noteAncestors(id: number): Note[] {
  const out: Note[] = [], seen = new Set<number>([id]); let cur = getNote(id)?.parent_id ?? null;
  while (cur && !seen.has(cur)) { seen.add(cur); const n = getNote(cur); if (!n) break; out.unshift(n); cur = n.parent_id; }
  return out;
}
/** Every page under this one, at any depth. */
export function noteDescendants(id: number): number[] {
  const all = new Map<number, number | null>((db.prepare("SELECT id, parent_id FROM notes WHERE deleted_at IS NULL").all() as { id: number; parent_id: number | null }[]).map((r) => [r.id, r.parent_id])), out: number[] = [], q = [id];
  while (q.length) { const c = q.shift()!; for (const [k, par] of all) if (par === c && !out.includes(k)) { out.push(k); q.push(k); } }
  return out;
}
/** Move a note under another (or to the top level with null). A page can't go inside itself or one of its own sub-pages. */
export function moveNote(id: number, parentId: number | null): string | null {
  if (!getNote(id)) return "That note is gone";
  if (parentId !== null) { if (!getNote(parentId)) return "That parent page is gone"; if (parentId === id || noteDescendants(id).includes(parentId)) return "A page can't go inside itself or one of its own sub-pages"; }
  db.prepare("UPDATE notes SET parent_id=?, updated_at=datetime('now'), rev=rev+1 WHERE id=?").run(parentId, id); record("note", id, "changed", { field: "Parent page", new: parentId ? getNote(parentId)!.title || "Untitled" : "(top level)" }); return null;
}
/** Order a flat list as a tree: parents first, children indented under them. A page whose parent isn't in the list (filtered out or deleted) is treated as top level. */
export function noteTree<T extends { id: number; parent_id: number | null }>(notes: T[]): (T & { depth: number })[] {
  const ids = new Set(notes.map((n) => n.id)), kids = new Map<number | null, T[]>();
  for (const n of notes) { const k = n.parent_id && ids.has(n.parent_id) ? n.parent_id : null; kids.set(k, [...(kids.get(k) ?? []), n]); }
  const out: (T & { depth: number })[] = [], seen = new Set<number>();
  const walk = (k: number | null, depth: number) => { for (const n of kids.get(k) ?? []) { if (seen.has(n.id)) continue; seen.add(n.id); out.push({ ...n, depth }); walk(n.id, depth + 1); } };
  walk(null, 0); return out;
}
