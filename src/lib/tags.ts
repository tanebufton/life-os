import { db } from "./db";
import { cleanTag } from "./tasks";

export type TagInfo = { id: number; name: string; color: string | null; tasks: number; notes: number; goals: number; total: number };
/** Every tag with how many of each kind of item carries it. */
export function allTags(): TagInfo[] {
  return (db.prepare(`SELECT g.id, g.name, g.color,
    (SELECT count(*) FROM task_tags tt JOIN tasks t ON t.id=tt.task_id WHERE tt.tag_id=g.id AND t.deleted_at IS NULL) AS tasks,
    (SELECT count(*) FROM entity_tags e WHERE e.tag_id=g.id AND e.kind='note') AS notes,
    (SELECT count(*) FROM entity_tags e WHERE e.tag_id=g.id AND e.kind='goal') AS goals
    FROM tags g ORDER BY g.name`).all() as Omit<TagInfo, "total">[]).map((t) => ({ ...t, total: t.tasks + t.notes + t.goals }));
}
const HEX = /^#[0-9a-f]{6}$/i;
export function setTagColor(name: string, color: string | null) {
  if (color !== null && !HEX.test(color)) throw new Error("Pick a colour");
  if (!db.prepare("UPDATE tags SET color=? WHERE name=?").run(color, cleanTag(name)).changes) throw new Error("No such tag");
}
/** Rename a tag. If the new name already exists the two are merged: everything tagged with either ends up with the one tag. */
export function renameTag(from: string, to: string): { merged: boolean; moved: number } {
  const a = cleanTag(from), b = cleanTag(to); if (!b) throw new Error("A tag needs a name");
  const src = db.prepare("SELECT id, color FROM tags WHERE name=?").get(a) as { id: number; color: string | null } | undefined; if (!src) throw new Error("No such tag");
  if (a === b) return { merged: false, moved: 0 };
  // Only the capital letters changed: it is the same tag, so just restyle it (not a merge).
  if (a.toLowerCase() === b.toLowerCase()) { db.prepare("UPDATE tags SET name=? WHERE id=?").run(b, src.id); return { merged: false, moved: 0 }; }
  const dst = db.prepare("SELECT id, color FROM tags WHERE name=?").get(b) as { id: number; color: string | null } | undefined;
  if (!dst) { db.prepare("UPDATE tags SET name=? WHERE id=?").run(b, src.id); return { merged: false, moved: 0 }; }
  return db.transaction(() => {
    const t = db.prepare("INSERT OR IGNORE INTO task_tags (task_id, tag_id) SELECT task_id, ? FROM task_tags WHERE tag_id=?").run(dst.id, src.id).changes;
    const e = db.prepare("INSERT OR IGNORE INTO entity_tags (kind, entity_id, tag_id) SELECT kind, entity_id, ? FROM entity_tags WHERE tag_id=?").run(dst.id, src.id).changes;
    if (!dst.color && src.color) db.prepare("UPDATE tags SET color=? WHERE id=?").run(src.color, dst.id);
    db.prepare("DELETE FROM tags WHERE id=?").run(src.id); // its rows go with it (cascade)
    return { merged: true, moved: t + e };
  })();
}
export function deleteTag(name: string): number {
  const r = db.prepare("SELECT id FROM tags WHERE name=?").get(cleanTag(name)) as { id: number } | undefined; if (!r) return 0;
  const n = (db.prepare("SELECT (SELECT count(*) FROM task_tags WHERE tag_id=?) + (SELECT count(*) FROM entity_tags WHERE tag_id=?) AS n").get(r.id, r.id) as { n: number }).n;
  db.prepare("DELETE FROM tags WHERE id=?").run(r.id); return n;
}
/** Tags nothing uses any more. */
export const unusedTags = () => allTags().filter((t) => t.total === 0);
export const pruneUnusedTags = () => { let n = 0; for (const t of unusedTags()) n += db.prepare("DELETE FROM tags WHERE id=?").run(t.id).changes; return n; };
/** CSS that gives coloured tags their chosen colour everywhere a tag pill is drawn. */
export function tagColorCss(): string {
  return (db.prepare("SELECT name, color FROM tags WHERE color IS NOT NULL").all() as { name: string; color: string }[])
    .filter((t) => HEX.test(t.color) && /^[\p{L}\p{N}_-]+$/u.test(t.name)).map((t) => `.pill[data-tag="${t.name.toLowerCase()}"]{--c:${parseInt(t.color.slice(1, 3), 16)} ${parseInt(t.color.slice(3, 5), 16)} ${parseInt(t.color.slice(5, 7), 16)} !important}`).join("");
}
