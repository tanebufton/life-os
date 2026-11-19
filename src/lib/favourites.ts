import { db } from "./db";

export type FavKind = "task" | "note" | "project";
export type Fav = { kind: FavKind; id: number; title: string; href: string; icon: string; color?: string };
export const isFavourite = (kind: FavKind, id: number) => !!db.prepare("SELECT 1 FROM favourites WHERE kind=? AND ref_id=?").get(kind, id);
/** Star or un-star something. Returns the new state. */
export function toggleFavourite(kind: FavKind, id: number): boolean {
  if (isFavourite(kind, id)) { db.prepare("DELETE FROM favourites WHERE kind=? AND ref_id=?").run(kind, id); return false; }
  const next = (db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS n FROM favourites").get() as { n: number }).n;
  db.prepare("INSERT INTO favourites (kind, ref_id, position) VALUES (?,?,?)").run(kind, id, next); return true;
}
/** Favourites in the order they were starred. Anything deleted or archived is skipped (and tidied away), so the list never has dead links. */
export function listFavourites(): Fav[] {
  const rows = db.prepare("SELECT kind, ref_id FROM favourites ORDER BY position, created_at").all() as { kind: FavKind; ref_id: number }[], out: Fav[] = [];
  for (const r of rows) {
    if (r.kind === "task") { const t = db.prepare("SELECT id, title FROM tasks WHERE id=? AND deleted_at IS NULL").get(r.ref_id) as { id: number; title: string } | undefined; if (t) out.push({ kind: "task", id: t.id, title: t.title, href: `/tasks/${t.id}`, icon: "" }); }
    else if (r.kind === "note") { const n = db.prepare("SELECT id, title, icon FROM notes WHERE id=? AND deleted_at IS NULL").get(r.ref_id) as { id: number; title: string; icon: string } | undefined; if (n) out.push({ kind: "note", id: n.id, title: n.title || "Untitled", href: `/notes/${n.id}`, icon: n.icon }); }
    else { const p = db.prepare("SELECT id, name, icon, color FROM projects WHERE id=? AND archived=0").get(r.ref_id) as { id: number; name: string; icon: string; color: string } | undefined; if (p) out.push({ kind: "project", id: p.id, title: p.name, href: `/projects/${p.id}`, icon: p.icon, color: p.color }); }
  }
  return out;
}
