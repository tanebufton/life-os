import assert from "node:assert/strict";
const T = await import("../src/lib/tasks.ts"); const A = await import("../src/lib/activity.ts"); const N = await import("../src/lib/notes.ts"); const G = await import("../src/lib/goals.ts"); const E = await import("../src/lib/entitytags.ts"); const S = await import("../src/lib/statuses.ts"); const { db } = await import("../src/lib/db.ts");
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); };
const txt = (e: string, id: number) => A.history(e as any, id).map((x: any) => A.describeEvent(x)).reverse();
const id = T.createTask({ title: "Audit me", due: "2030-01-01", priority: 0 });
T.updateTask(id, { title: "Audited", due: "2030-02-02", priority: 1, estimate: 30, tags: ["a", "b"] }); T.updateTask(id, { title: "Audited" }); // no-op
let h = txt("task", id); assert.equal(h[0], "Created"); assert.ok(h.includes("Title: Audit me → Audited") && h.includes("Due: 2030-01-01 → 2030-02-02") && h.includes("Priority: 0 → 1") && h.includes("Estimate: none → 30") && h.includes("Tags: none → a b")); assert.equal(h.filter((x) => x.startsWith("Title")).length, 1); ok("task edits record one line per field that really changed, with before and after");
T.completeTask(id); T.reopenTask(id); h = txt("task", id); assert.ok(h.includes("Completed") && h.includes("Reopened")); ok("completing and reopening are recorded");
T.setStatus(id, "doing"); assert.ok(txt("task", id).includes("Status: To do → In progress")); ok("moving between columns is recorded with the column names");
T.reschedule(id, "tomorrow"); assert.ok(txt("task", id).some((x: string) => x.startsWith("Due:"))); T.deleteTask(id); T.restoreTask(id); h = txt("task", id); assert.ok(h.includes("Deleted") && h.includes("Restored")); ok("rescheduling, deleting and restoring are recorded");
T.updateTask(id, { notes: "x".repeat(40) }); assert.ok(txt("task", id).some((x: string) => x.startsWith("Edited notes"))); assert.ok(!JSON.stringify(A.history("task", id)).includes("xxxxxxxx")); ok("notes edits log a size change, never the text itself");
A.runAs("telegram", () => T.updateTask(id, { title: "From bot" })); assert.equal(A.history("task", id)[0].actor, "telegram"); assert.equal(A.history("task", id).at(-1)!.actor, "you"); ok("changes are attributed to who made them (you, telegram, api, mcp…)");
// notes: history + versions + restore
const nid = N.createNote("Note", "first draft text"); N.updateNote(nid, { body: "second draft text" }); N.updateNote(nid, { body: "third draft text" }); N.updateNote(nid, { title: "Renamed" });
h = txt("note", nid); assert.equal(h.filter((x) => x.startsWith("Edited")).length, 1); assert.ok(h.includes("Title: Note → Renamed")); ok("a burst of note edits is one history entry, not one per save");
let vs = N.noteVersions(nid); assert.equal(vs.length, 1); assert.equal(vs[0].body, "first draft text"); ok("the text from before an editing session is kept as a version");
db.prepare("UPDATE note_versions SET at=datetime('now','-20 minutes') WHERE note_id=?").run(nid); db.prepare("UPDATE activity SET at=datetime('now','-20 minutes') WHERE entity='note' AND entity_id=?").run(nid); N.updateNote(nid, { body: "fourth draft text" }); vs = N.noteVersions(nid); assert.equal(vs.length, 2); assert.equal(vs[0].body, "third draft text"); ok("a later session saves another version");
assert.ok(N.restoreNoteVersion(nid, vs.at(-1)!.id)); assert.equal(N.getNote(nid)!.body, "first draft text"); assert.ok(N.noteVersions(nid).some((v) => v.body === "fourth draft text")); ok("restoring a version works and keeps what it replaced");
for (let i = 0; i < 40; i++) { db.prepare("UPDATE note_versions SET at=datetime('now','-1 day') WHERE note_id=?").run(nid); N.updateNote(nid, { body: "v" + i }); } assert.ok(N.noteVersions(nid).length <= 30); ok("versions are capped at 30 per note");
// goals
const gid = G.createGoal({ title: "Goal" }); const kr = G.addKeyResult(gid, "Steps", 10); G.setKeyResult(kr, 4); G.setGoalStatus(gid, "done"); h = txt("goal", gid); assert.ok(h.includes("Steps: 0 → 4") && h.includes("Status: active → done")); ok("goal progress and status changes are recorded");
// tags on other items
E.setEntityTags("note", nid, ["Work", "ideas", "work", "#Ideas"]); assert.ok(txt("note", nid).includes("Tags: none → Work ideas")); assert.deepEqual(E.entityTags("note", nid), ["ideas", "Work"]); N.updateNote(nid, { project_id: null }); const pj = Number(db.prepare("INSERT INTO projects (name) VALUES ('Named')").run().lastInsertRowid); N.updateNote(nid, { project_id: pj }); assert.ok(txt("note", nid).includes("Project: none → Named")); E.setEntityTags("goal", gid, ["health"]); assert.deepEqual(E.entityTags("goal", gid), ["health"]); assert.deepEqual(E.idsWithTag("note", "WORK"), [nid]); assert.deepEqual(E.tagCounts("note").map((t) => t.name).sort(), ["Work", "ideas"]); E.setEntityTags("note", nid, []); assert.deepEqual(E.entityTags("note", nid), []); ok("tags on notes and goals: cleaned, de-duplicated, searchable, removable, shared with task tags");
// custom columns keep activity names consistent and per-project works
const pid = Number(db.prepare("INSERT INTO projects (name) VALUES ('P')").run().lastInsertRowid); S.customizeProject(pid); S.addColumn(pid, "In review", "doing"); const t2 = T.createTask({ title: "In P", project_id: pid }); T.setStatus(t2, "In review"); assert.equal(T.getTask(t2)!.status_name, "In review"); assert.equal(T.getTask(t2)!.status_kind, "doing"); ok("a project's own column works for status changes");
assert.ok(A.pruneActivity(365) >= 0); console.log(`\n${n} checks passed`);
{
  const N2 = await import("../src/lib/notes.ts"), A2 = await import("../src/lib/activity.ts");
  const id = N2.createNote("", ""); for (const t of ["B", "Ba", "Bai", "Baikal", "Baikal RFP", "Baikal RFP - Test 1"]) N2.updateNote(id, { title: t });
  const ev = A2.history("note", id).filter((e: any) => e.field === "Title"); assert.equal(ev.length, 1); assert.equal(ev[0].new, "Baikal RFP - Test 1"); console.log("  ✓ typing a title leaves one history entry, not one per keystroke");
  N2.updateNote(id, { title: "Baikal RFP - Test 1x" }); N2.updateNote(id, { title: "Baikal RFP - Test 1" }); assert.equal(A2.history("note", id).filter((e: any) => e.field === "Title").length, 1); console.log("  ✓ changing it and changing it back adds nothing");
}
