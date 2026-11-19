import { record, type Entity } from "./activity";
import { db } from "./db";

export type LinkKind = "task" | "note" | "goal";
export const LINK_KINDS: LinkKind[] = ["task", "note", "goal"];
export type Linked = { kind: LinkKind; id: number; title: string; href: string; meta?: string };
const LABEL: Record<LinkKind, string> = { task: "Task", note: "Note", goal: "Goal" };

/** Title (and where it lives) of an item, or null if it doesn't exist or was deleted. */
export function describe(kind: LinkKind, id: number): Linked | null {
  switch (kind) {
    case "task": { const r = db.prepare("SELECT title, done_at FROM tasks WHERE id=? AND deleted_at IS NULL").get(id) as { title: string; done_at: string | null } | undefined; return r ? { kind, id, title: r.title, href: `/tasks/${id}`, meta: r.done_at ? "done" : undefined } : null; }
    case "note": { const r = db.prepare("SELECT title FROM notes WHERE id=? AND deleted_at IS NULL").get(id) as { title: string } | undefined; return r ? { kind, id, title: r.title || "Untitled", href: `/notes/${id}` } : null; }
    case "goal": { const r = db.prepare("SELECT title FROM goals WHERE id=?").get(id) as { title: string } | undefined; return r ? { kind, id, title: r.title, href: "/goals" } : null; }
  }
}
// A link is stored once, with its two ends in a fixed order, and shows from both sides.
const order = (ak: LinkKind, ai: number, bk: LinkKind, bi: number) => (ak < bk || (ak === bk && ai <= bi) ? [ak, ai, bk, bi] : [bk, bi, ak, ai]) as [LinkKind, number, LinkKind, number];
export function addLink(ak: LinkKind, ai: number, bk: LinkKind, bi: number): boolean {
  if (!LINK_KINDS.includes(ak) || !LINK_KINDS.includes(bk)) throw new Error("Can't link those");
  if (ak === bk && ai === bi) throw new Error("An item can't link to itself");
  const a = describe(ak, ai), b = describe(bk, bi); if (!a || !b) throw new Error("One of those no longer exists");
  const r = db.prepare("INSERT OR IGNORE INTO item_links (a_kind, a_id, b_kind, b_id) VALUES (?,?,?,?)").run(...order(ak, ai, bk, bi));
  if (r.changes) { record(ak as Entity, ai, "linked", { field: LABEL[bk], new: b.title }); record(bk as Entity, bi, "linked", { field: LABEL[ak], new: a.title }); }
  return r.changes > 0;
}
export function removeLink(ak: LinkKind, ai: number, bk: LinkKind, bi: number): boolean {
  const r = db.prepare("DELETE FROM item_links WHERE a_kind=? AND a_id=? AND b_kind=? AND b_id=?").run(...order(ak, ai, bk, bi));
  if (r.changes) { record(ak as Entity, ai, "unlinked", { field: LABEL[bk], old: describe(bk, bi)?.title }); record(bk as Entity, bi, "unlinked", { field: LABEL[ak], old: describe(ak, ai)?.title }); }
  return r.changes > 0;
}
/** Everything linked to this item, from either side. Items that were deleted since are left out (and clean themselves up). */
export function listLinks(kind: LinkKind, id: number): Linked[] {
  const rows = db.prepare("SELECT a_kind, a_id, b_kind, b_id FROM item_links WHERE (a_kind=? AND a_id=?) OR (b_kind=? AND b_id=?) ORDER BY id").all(kind, id, kind, id) as { a_kind: LinkKind; a_id: number; b_kind: LinkKind; b_id: number }[];
  return rows.flatMap((r) => { const other = r.a_kind === kind && r.a_id === id ? describe(r.b_kind, r.b_id) : describe(r.a_kind, r.a_id); return other ? [other] : []; });
}
export const linkCount = (kind: LinkKind, id: number) => listLinks(kind, id).length;
