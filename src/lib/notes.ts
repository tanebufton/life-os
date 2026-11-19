import { db } from "./db";

export type Note = { id: number; title: string; body: string; pinned: number; created_at: string; updated_at: string };
export const getNote = (id: number) => db.prepare("SELECT * FROM notes WHERE id=? AND deleted_at IS NULL").get(id) as Note | undefined;
export const noteByTitle = (title: string) => db.prepare("SELECT * FROM notes WHERE lower(title)=lower(?) AND deleted_at IS NULL").get(title.trim()) as Note | undefined;
export function listNotes(o: { q?: string; limit?: number } = {}): Note[] {
  const like = o.q ? `%${o.q.replace(/[\\%_]/g, (c) => "\\" + c)}%` : null;
  return db.prepare(`SELECT * FROM notes WHERE deleted_at IS NULL ${like ? "AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')" : ""} ORDER BY pinned DESC, updated_at DESC LIMIT ?`).all(...(like ? [like, like] : []), o.limit ?? 200) as Note[];
}
export function createNote(title = "", body = ""): number { return Number(db.prepare("INSERT INTO notes (title, body) VALUES (?,?)").run(title.trim(), body).lastInsertRowid); }
export function updateNote(id: number, p: { title?: string; body?: string; pinned?: boolean }): boolean {
  const sets: string[] = ["updated_at=datetime('now')"], a: unknown[] = [];
  if (p.title !== undefined) { sets.push("title=?"); a.push(p.title.trim().slice(0, 200)); } if (p.body !== undefined) { sets.push("body=?"); a.push(p.body.slice(0, 200_000)); } if (p.pinned !== undefined) { sets.push("pinned=?"); a.push(p.pinned ? 1 : 0); }
  return db.prepare(`UPDATE notes SET ${sets.join(",")} WHERE id=? AND deleted_at IS NULL`).run(...a, id).changes > 0;
}
export const deleteNote = (id: number) => db.prepare("UPDATE notes SET deleted_at=datetime('now') WHERE id=?").run(id).changes > 0;
export const restoreNote = (id: number) => db.prepare("UPDATE notes SET deleted_at=NULL WHERE id=?").run(id).changes > 0;
/** Notes that link to this one with [[Title]]. */
export function backlinks(note: Note): Note[] { if (!note.title.trim()) return []; return db.prepare("SELECT * FROM notes WHERE deleted_at IS NULL AND id!=? AND lower(body) LIKE ? ORDER BY updated_at DESC").all(note.id, `%[[${note.title.toLowerCase().replace(/[\\%_]/g, (c) => "\\" + c)}]]%`.replace(/\\/g, "\\")) as Note[]; }
export const resolver = () => { const m = new Map((db.prepare("SELECT id, title FROM notes WHERE deleted_at IS NULL").all() as { id: number; title: string }[]).map((n) => [n.title.toLowerCase(), n.id])); return (t: string) => m.get(t.toLowerCase()) ?? null; };
