import { db } from "./db";
import { record, type Entity } from "./activity";
import { cleanTag, ensureTag, parseTags, uniqueTags } from "./tasks";

export type TagKind = "note" | "goal";
export { parseTags };
export const entityTags = (kind: TagKind, id: number): string[] => (db.prepare("SELECT g.name FROM entity_tags e JOIN tags g ON g.id=e.tag_id WHERE e.kind=? AND e.entity_id=? ORDER BY g.name").all(kind, id) as { name: string }[]).map((r) => r.name);
export function setEntityTags(kind: TagKind, id: number, names: string[]) {
  const clean = uniqueTags(names.map(cleanTag)).slice(0, 20), was = entityTags(kind, id).join(" ");
  if (was !== [...clean].sort().join(" ")) record(kind as Entity, id, "changed", { field: "Tags", old: was, new: [...clean].sort().join(" ") });
  db.transaction(() => {
    db.prepare("DELETE FROM entity_tags WHERE kind=? AND entity_id=?").run(kind, id);
    for (const n of clean) db.prepare("INSERT OR IGNORE INTO entity_tags (kind, entity_id, tag_id) VALUES (?,?,?)").run(kind, id, ensureTag(n, true));
  })();
}
/** Tags in use for one kind of item, with how many items carry each. */
export const tagCounts = (kind: TagKind) => db.prepare("SELECT g.name, count(*) n FROM entity_tags e JOIN tags g ON g.id=e.tag_id WHERE e.kind=? GROUP BY g.id ORDER BY n DESC, g.name").all(kind) as { name: string; n: number }[];
export const idsWithTag = (kind: TagKind, tag: string): number[] => (db.prepare("SELECT e.entity_id id FROM entity_tags e JOIN tags g ON g.id=e.tag_id WHERE e.kind=? AND g.name=?").all(kind, cleanTag(tag)) as { id: number }[]).map((r) => r.id);
/** Tag names for many items at once (for list pages). */
export function tagsFor(kind: TagKind, ids: number[]): Map<number, string[]> {
  const m = new Map<number, string[]>(); if (!ids.length) return m;
  for (const r of db.prepare(`SELECT e.entity_id id, g.name FROM entity_tags e JOIN tags g ON g.id=e.tag_id WHERE e.kind=? AND e.entity_id IN (${ids.map(() => "?").join(",")}) ORDER BY g.name`).all(kind, ...ids) as { id: number; name: string }[]) (m.get(r.id) ?? m.set(r.id, []).get(r.id)!).push(r.name);
  return m;
}
