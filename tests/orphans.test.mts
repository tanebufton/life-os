import assert from "node:assert/strict";
const { db, repairStatuses } = await import("../src/lib/db.ts"); const T = await import("../src/lib/tasks.ts"); const S = await import("../src/lib/statuses.ts");
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); };
const proj = Number(db.prepare("INSERT INTO projects (name, color) VALUES ('Mercury','#123456')").run().lastInsertRowid);
S.customizeProject(proj); const cols = S.listStatuses(proj); const doneKey = cols.find((c: any) => c.kind === "done")!.key, firstTodo = cols.find((c: any) => c.kind === "todo")!.key;
assert.notEqual(doneKey, "done"); ok("a project with its own columns has its own done column key");
const finished = T.createTask({ title: "Shipped it", project_id: proj }); T.completeTask(finished); assert.equal(T.getTask(finished)!.status, doneKey); ok("completing a card puts it in the project's done column");
// what the old start-up step did to it
db.prepare("UPDATE tasks SET status='done' WHERE id=?").run(finished); assert.equal(S.listStatuses(proj).some((c: any) => c.key === "done"), false);
const openOrphan = T.createTask({ title: "Open but stray", project_id: proj }); db.prepare("UPDATE tasks SET status='todo' WHERE id=?").run(openOrphan);
const fine = T.createTask({ title: "Fine", project_id: proj }); db.prepare("UPDATE tasks SET status=? WHERE id=?").run(cols.find((c: any) => c.kind === "doing")?.key ?? firstTodo, fine);
const plainDone = T.createTask({ title: "Plain board, done" }); T.completeTask(plainDone); const legacy = T.createTask({ title: "Old completed card" }); db.prepare("UPDATE tasks SET done_at=datetime('now'), status='todo' WHERE id=?").run(legacy);
const before = T.getTask(fine)!.status; const moved = repairStatuses(db);
assert.equal(T.getTask(finished)!.status, doneKey); ok("a completed card orphaned in a project with its own columns goes back to that project's done column");
assert.equal(T.getTask(openOrphan)!.status, firstTodo); ok("an open card in a column its board doesn't have goes to a to-do column");
assert.equal(T.getTask(fine)!.status, before); assert.equal(T.getTask(plainDone)!.status, "done"); ok("cards already in a valid column are left alone");
assert.equal(T.getTask(legacy)!.status, "done"); ok("a completed card still marked to-do (from before columns) is shown as done");
assert.equal(moved >= 3, true); assert.equal(repairStatuses(db), 0); ok("running it again changes nothing");
// the board's own query now sees the finished card
assert.ok(T.queryTasks({ project: proj, state: "done", limit: 50 }).some((t: any) => t.id === finished && t.status === doneKey)); ok("the finished card is listed in its project's done column");
console.log(`  ${n} checks`);
