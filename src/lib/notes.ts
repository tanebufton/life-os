import { db } from "./db";

import { record } from "./activity";
export type Note = { project_id: number | null; id: number; title: string; body: string; pinned: number; created_at: string; updated_at: string };
export const getNote = (id: number) => db.prepare("SELECT * FROM notes WHERE id=? AND deleted_at IS NULL").get(id) as Note | undefined;
export const noteByTitle = (title: string) => db.prepare("SELECT * FROM notes WHERE lower(title)=lower(?) AND deleted_at IS NULL").get(title.trim()) as Note | undefined;
export function listNotes(o: { q?: string; limit?: number; project?: number; ids?: number[] } = {}): Note[] {
  const like = o.q ? `%${o.q.replace(/[\\%_]/g, (c) => "\\" + c)}%` : null, w = ["deleted_at IS NULL"], a: unknown[] = [];
  if (like) { w.push("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')"); a.push(like, like); }
  if (o.project) { w.push("project_id=?"); a.push(o.project); }
  if (o.ids) { if (!o.ids.length) return []; w.push(`id IN (${o.ids.map(() => "?").join(",")})`); a.push(...o.ids); }
  return db.prepare(`SELECT * FROM notes WHERE ${w.join(" AND ")} ORDER BY pinned DESC, updated_at DESC LIMIT ?`).all(...a, o.limit ?? 200) as Note[];
}
export function createNote(title = "", body = "", projectId: number | null = null): number { const id = Number(db.prepare("INSERT INTO notes (title, body, project_id) VALUES (?,?,?)").run(title.trim(), body, projectId).lastInsertRowid); record("note", id, "created", { new: title }); return id; }
const VERSION_EVERY_MIN = 10, KEEP_VERSIONS = 30;
export function updateNote(id: number, p: { title?: string; body?: string; pinned?: boolean; project_id?: number | null }): boolean {
  const before = db.prepare("SELECT * FROM notes WHERE id=? AND deleted_at IS NULL").get(id) as Note | undefined; if (!before) return false;
  const sets: string[] = ["updated_at=datetime('now')"], a: unknown[] = [];
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
