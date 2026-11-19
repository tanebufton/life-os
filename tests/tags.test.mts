import assert from "node:assert/strict";
const G = await import("../src/lib/tags.ts"); const T = await import("../src/lib/tasks.ts"); const N = await import("../src/lib/notes.ts"); const E = await import("../src/lib/entitytags.ts"); const { db } = await import("../src/lib/db.ts");
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); }; const info = (name: string) => G.allTags().find((t: any) => t.name === name);
const t1 = T.createTask({ title: "A", tags: ["work", "urgent"] }), t2 = T.createTask({ title: "B", tags: ["wrok"] }), note = N.createNote("N", "x"); E.setEntityTags("note", note, ["wrok", "ideas"]);
assert.equal(info("work").tasks, 1); assert.equal(info("wrok").tasks, 1); assert.equal(info("wrok").notes, 1); ok("tags are counted per kind of item");
let r = G.renameTag("wrok", "work"); assert.equal(r.merged, true); assert.equal(info("wrok"), undefined); assert.equal(info("work").tasks, 2); assert.equal(info("work").notes, 1); assert.deepEqual(T.getTask(t2)!.tags, ["work"]); assert.deepEqual(E.entityTags("note", note), ["ideas", "work"]); ok("renaming onto an existing tag merges them across tasks and notes");
T.updateTask(t1, { tags: ["work", "urgent"] }); G.renameTag("work", "work"); assert.equal(info("work").tasks, 2); ok("an item that had both tags ends up with one, not a duplicate");
G.renameTag("urgent", "asap"); assert.deepEqual(T.getTask(t1)!.tags.sort(), ["asap", "work"]); ok("plain rename keeps every item tagged");
G.renameTag("asap", "#Rush Hour"); assert.ok(info("Rush-Hour")); ok("new names are cleaned like any tag");
assert.throws(() => G.renameTag("nope", "x"), /No such tag/); assert.throws(() => G.renameTag("work", "  "), /needs a name/); ok("unknown tags and empty names are refused");
G.setTagColor("work", "#112233"); assert.match(G.tagColorCss(), /\.pill\[data-tag="work"\]\{--c:17 34 51 !important\}/); assert.throws(() => G.setTagColor("work", "red; } body{display:none"), /Pick a colour/); G.setTagColor("work", null); assert.equal(G.tagColorCss().includes("work"), false); ok("colours become CSS only if they're valid hex (no way to inject styles)");
G.setTagColor("ideas", "#aabbcc"); G.renameTag("ideas", "thoughts"); assert.equal(info("thoughts").color, "#aabbcc"); ok("a colour survives a rename");
const removed = G.deleteTag("work"); assert.equal(removed, 3); assert.deepEqual(T.getTask(t1)!.tags, ["Rush-Hour"]); assert.ok(T.getTask(t2)); ok("deleting a tag untags items but never deletes them");
db.prepare("INSERT INTO tags (name) VALUES ('orphan')").run(); assert.ok(G.unusedTags().some((x: any) => x.name === "orphan")); assert.ok(G.pruneUnusedTags() >= 1); assert.equal(info("orphan"), undefined); ok("unused tags can be cleaned up");
console.log(`\n${n} checks passed`);
{
  const T = await import("../src/lib/tasks.ts"); const E = await import("../src/lib/entitytags.ts"); const G = await import("../src/lib/tags.ts"); const N = await import("../src/lib/notes.ts");
  const names = (id: number) => T.getTask(id)!.tags;
  const a = T.createTask({ title: "case one", tags: ["Family"] }); assert.deepEqual(names(a), ["Family"]); console.log("  ✓ a new tag keeps the capitals you typed");
  assert.deepEqual(T.parseTags("Work work WORK Home"), ["Work", "Home"]); console.log("  ✓ spellings that differ only by case are one tag");
  const b = T.createTask({ title: "case two", tags: ["family"] }); assert.deepEqual(names(b), ["Family"]); console.log("  ✓ quick-add keeps the existing spelling instead of flipping it");
  T.updateTask(b, { tags: ["FAMILY"] }); assert.deepEqual(names(b), ["FAMILY"]); assert.deepEqual(names(a), ["FAMILY"]); console.log("  ✓ typing a tag in the tags field adopts the case you typed, everywhere it's used");
  assert.equal(T.queryTasks({ tag: "family" }).length, 2); assert.equal(T.queryTasks({ tag: "FaMiLy" }).length, 2); console.log("  ✓ filtering by tag ignores case");
  const n = N.createNote("n"); E.setEntityTags("note", n, ["Ideas"]); assert.deepEqual(E.entityTags("note", n), ["Ideas"]); console.log("  ✓ notes keep tag case too");
  G.renameTag("Ideas", "IDEAS"); assert.deepEqual(E.entityTags("note", n), ["IDEAS"]); assert.equal(G.allTags().filter((t: any) => t.name.toLowerCase() === "ideas").length, 1); console.log("  ✓ renaming only the capitals restyles the tag (no merge, no duplicate)");
}
