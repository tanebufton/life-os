import assert from "node:assert/strict";
const A = await import("../src/lib/automations.ts"); const T = await import("../src/lib/tasks.ts"); const { db, dbFile } = await import("../src/lib/db.ts"); const { today } = await import("../src/lib/time.ts"); const { addDays } = await import("../src/lib/dates.ts");
const Database = (await import("better-sqlite3")).default;
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); };
const t0 = today();
db.prepare("INSERT INTO statuses (project_id, key, name, kind, position) VALUES (NULL, 'today', 'Today', 'doing', 1)").run();
const rev = () => (db.prepare("SELECT rev FROM data_rev WHERE id=1").get() as { rev: number }).rev;
const r0 = rev(); T.createTask({ title: "bump" }); assert.ok(rev() > r0); ok("any change bumps the change counter");
const other = new Database(dbFile); const r1 = rev(); other.prepare("UPDATE tasks SET title='bump2' WHERE title='bump'").run(); other.close(); assert.ok(rev() > r1); ok("a change from another connection (the worker, the MCP server) bumps it too");

const first = T.createTask({ title: "Already in Today", due: addDays(t0, 5) }); db.prepare("UPDATE tasks SET status='today', position=100 WHERE id=?").run(first);
const due = T.createTask({ title: "Due today", due: t0 }), later = T.createTask({ title: "Due in ten days", due: addDays(t0, 10) }), none = T.createTask({ title: "No date" }), dn = T.createTask({ title: "Finished", due: t0 }); T.completeTask(dn);
const stale = T.createTask({ title: "Overdue before the rule", due: addDays(t0, -4) });
const rid = A.saveRule({ project_id: null, offset_days: 0, column_key: "today", to_top: true, set_priority: 1 });
assert.equal(A.runBoardAutomations({ force: true }), 1);
let c = T.getTask(due)!; assert.equal(c.status, "today"); assert.equal(c.priority, 1); assert.ok((c.position ?? 0) < 100); ok("on the due date the card moves to the column, to the top, with the priority set");
assert.equal(T.getTask(later)!.status, "todo"); assert.equal(T.getTask(none)!.status, "todo"); assert.equal(T.getTask(dn)!.status, "done"); ok("cards that aren't due, have no date, or are finished are left alone");
assert.equal(T.getTask(stale)!.status, "todo"); ok("cards already overdue when the rule was made are left where they are");
T.setStatus(due, "todo"); assert.equal(A.runBoardAutomations({ force: true }), 0); assert.equal(T.getTask(due)!.status, "todo"); ok("a card you move back by hand stays put (once per due date)");
T.updateTask(due, { due: addDays(t0, 3) }); assert.equal(A.runBoardAutomations({ force: true, now: addDays(t0, 3) }), 1); assert.equal(T.getTask(due)!.status, "today"); ok("a new due date triggers it again when that day comes");
A.saveRule({ id: rid, project_id: null, offset_days: 1, column_key: "today", to_top: true, set_priority: null }); assert.equal(A.runBoardAutomations({ force: true, now: addDays(t0, 9) }), 1); assert.equal(T.getTask(later)!.status, "today"); ok("\"1 day before\" catches the cards due the next day");
assert.throws(() => A.saveRule({ project_id: null, offset_days: 0, column_key: "done", to_top: true, set_priority: null })); assert.throws(() => A.saveRule({ project_id: null, offset_days: 0, column_key: "nope", to_top: true, set_priority: null })); ok("rules can't target a Done column or a column that doesn't exist");
db.prepare("UPDATE board_rules SET enabled=0 WHERE id=?").run(rid); const x = T.createTask({ title: "Off", due: t0 }); assert.equal(A.runBoardAutomations({ force: true }), 0); assert.equal(T.getTask(x)!.status, "todo"); ok("a switched-off rule does nothing");
assert.equal(A.deleteRule(rid), true); assert.equal(A.listRules(null).length, 0); ok("rules can be deleted");
// ---- more triggers and actions
const T2 = (await import("../src/lib/tasks.ts")), col = (k: string) => db.prepare("INSERT OR IGNORE INTO statuses (project_id, key, name, kind, position) VALUES (NULL, ?, ?, 'todo', 5)").run(k, k[0].toUpperCase() + k.slice(1));
col("waiting"); db.prepare("DELETE FROM rule_runs").run();
const enter = A.saveRule({ project_id: null, kind: "enter", when_column: "waiting", offset_days: 0, column_key: "", to_top: false, set_priority: null, add_tag: "#chase", set_due: "tomorrow" });
const w = T2.createTask({ title: "Waiting on someone" }); db.prepare("UPDATE board_rules SET created_at = datetime('now','-1 minute') WHERE id=?").run(enter);
assert.equal(A.runBoardAutomations({ force: true }), 0); assert.equal(T2.getTask(w)!.due, null); ok("an \"entered a column\" rule ignores cards that weren't moved");
T2.setStatus(w, "waiting"); A.runBoardAutomations({ force: true }); let wt = T2.getTask(w)!; assert.deepEqual(wt.tags, ["chase"]); assert.equal(wt.due, addDays(today(), 1)); assert.equal(wt.status, "waiting"); ok("moving a card into the column adds the tag and sets the due date, without moving it");
A.runBoardAutomations({ force: true }); assert.deepEqual(T2.getTask(w)!.tags, ["chase"]); ok("and only once for that visit");
const staleRule = A.saveRule({ project_id: null, kind: "stale", when_column: "waiting", offset_days: 3, column_key: "todo", to_top: true, set_priority: 1, add_tag: "", set_due: "" });
const old = T2.createTask({ title: "Stuck" }); db.prepare("UPDATE tasks SET status='waiting' WHERE id=?").run(old); db.prepare("UPDATE tasks SET status_at=datetime('now','-5 days') WHERE id=?").run(old);
const fresh = T2.createTask({ title: "Just arrived" }); db.prepare("UPDATE tasks SET status='waiting' WHERE id=?").run(fresh); db.prepare("UPDATE tasks SET status_at=datetime('now','-1 day') WHERE id=?").run(fresh);
A.runBoardAutomations({ force: true }); assert.equal(T2.getTask(old)!.status, "todo"); assert.equal(T2.getTask(old)!.priority, 1); assert.equal(T2.getTask(fresh)!.status, "waiting"); ok("a card that has sat in a column long enough is moved and bumped; a recent one is left");
const created = A.saveRule({ project_id: null, kind: "created", when_column: "", offset_days: 0, column_key: "", to_top: false, set_priority: -1, add_tag: "inbox-zero", set_due: "" }); db.prepare("UPDATE board_rules SET created_at = datetime('now','-1 minute') WHERE id=?").run(created);
const nc = T2.createTask({ title: "Brand new" }); A.runBoardAutomations({ force: true }); assert.equal(T2.getTask(nc)!.priority, -1); assert.ok(T2.getTask(nc)!.tags.includes("inbox-zero")); ok("a \"card is created\" rule tags and prioritises new cards");
assert.throws(() => A.saveRule({ project_id: null, kind: "due", offset_days: 0, column_key: "", to_top: false, set_priority: null })); assert.throws(() => A.saveRule({ project_id: null, kind: "enter", when_column: "", offset_days: 0, column_key: "todo", to_top: false, set_priority: null })); assert.throws(() => A.saveRule({ project_id: null, kind: "nope", offset_days: 0, column_key: "todo", to_top: false, set_priority: null })); ok("a rule must do something, and watch a real column");
// two rules that send a card back and forth can't loop forever
db.prepare("DELETE FROM board_rules").run(); db.prepare("DELETE FROM rule_runs").run(); col("ping"); col("pong");
for (const [a, b] of [["ping", "pong"], ["pong", "ping"]]) { const id = A.saveRule({ project_id: null, kind: "enter", when_column: a, offset_days: 0, column_key: b, to_top: false, set_priority: null }); db.prepare("UPDATE board_rules SET created_at = datetime('now','-1 hour') WHERE id=?").run(id); }
const pp = T2.createTask({ title: "Ping pong" }); T2.setStatus(pp, "ping"); let runs = 0; for (let i = 0; i < 30; i++) { if (A.runBoardAutomations({ force: true })) runs++; } assert.ok(runs <= 8, `kept bouncing: ${runs}`); ok("rules that keep sending a card back and forth stop after a few goes");
console.log(`  ${n} checks`);
