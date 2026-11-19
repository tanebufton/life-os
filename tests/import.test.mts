import assert from "node:assert/strict";
const I = await import("../src/lib/importer.ts"); const T = await import("../src/lib/tasks.ts"); const N = await import("../src/lib/notes.ts"); const E = await import("../src/lib/entitytags.ts"); const X = await import("../src/lib/exporter.ts"); const { db } = await import("../src/lib/db.ts");
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); };
const todoist = `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE
section,Shopping,,,,,,,,
task,Buy milk,"2 litres, full cream",1,1,Me (1),,2030-05-01,en,Pacific/Auckland
task,Check expiry,,4,2,Me (1),,,en,
task,Water plants,,4,1,Me (1),,every week,en,
note,Remember the oat one,,,,,,,,
task,"Ring, the vet",,2,1,Me (1),,,en,
`;
let p = I.parseImport([{ name: "Home Stuff.csv", text: todoist }]);
assert.deepEqual(p.formats, ["Todoist CSV"]); assert.equal(p.tasks.length, 4); assert.equal(p.tasks[0].title, "Buy milk"); assert.equal(p.tasks[0].notes.includes("2 litres, full cream"), true); assert.equal(p.tasks[0].due, "2030-05-01"); assert.equal(p.tasks[0].priority, 1); assert.equal(p.tasks[0].project, "Home Stuff"); ok("Todoist CSV: tasks, descriptions, dates, priority 1 = high, project from the file name");
assert.equal(p.tasks[1].parent, 0); assert.equal(p.tasks[2].parent, null); ok("Todoist CSV: indented tasks become subtasks");
assert.ok(p.tasks[2].repeat); assert.ok(p.tasks[0].notes.includes("Remember the oat one") === false && p.tasks[2].notes.includes("Remember the oat one")); ok("Todoist CSV: 'every week' becomes a repeat, and comments attach to the task above");
assert.ok(p.warnings.some((w: string) => /section/.test(w)) && p.tasks[3].title === "Ring, the vet"); ok("sections are reported, and commas inside quotes are handled");
const generic = `Name,Tags,Due,Status,Priority,Notes\nWrite report,"work, q4",2030-06-01,Done,high,Final draft\nCall mum,family,,Not started,,\n,,,,,\n`;
p = I.parseImport([{ name: "tasks.csv", text: generic }], { project: "Imported" }); assert.equal(p.tasks.length, 2); assert.deepEqual(p.tasks[0].tags, ["work", "q4"]); assert.equal(p.tasks[0].done, true); assert.equal(p.tasks[1].done, false); assert.equal(p.tasks[0].priority, 1); assert.equal(p.tasks[0].project, "Imported"); ok("generic/Notion-style CSV: title, tags, due, status → done, priority, blank rows skipped");
p = I.parseImport([{ name: "bad.csv", text: "a,b\n1,2\n" }]); assert.equal(p.tasks.length, 0); assert.ok(p.warnings[0].includes("title column")); ok("a CSV without a title column is explained, not guessed");
const md = `# Meeting notes\nTags: work, q4\nCreated: today\n\nAgenda\n- one\n- two\n`;
p = I.parseImport([{ name: "Meeting notes abcdefabcdefabcdefabcdefabcdefab.md", text: md }, { name: "plain.txt", text: "just text" }, { name: "x.zip", text: "PK" }]); assert.equal(p.notes.length, 2); assert.equal(p.notes[0].title, "Meeting notes"); assert.deepEqual(p.notes[0].tags, ["work", "q4"]); assert.ok(p.notes[0].body.startsWith("Agenda")); assert.equal(p.notes[1].title, "plain"); assert.ok(p.warnings.some((w: string) => /unzip/.test(w))); ok("Markdown/text files become notes (title from the heading or file name, Notion tag lines read, zips explained)");
// run
const before = (db.prepare("SELECT count(*) c FROM tasks").get() as any).c; p = I.parseImport([{ name: "Home Stuff.csv", text: todoist }, { name: "m.md", text: md }]); let r = I.runImport(p);
assert.deepEqual([r.tasks, r.subtasks, r.notes, r.skipped], [3, 1, 1, 0]); assert.equal((db.prepare("SELECT count(*) c FROM tasks").get() as any).c, before + 4); const milk = db.prepare("SELECT id FROM tasks WHERE title='Buy milk'").get() as any; assert.equal(T.getTask(milk.id)!.project_name, "Home Stuff"); assert.equal(T.getTask(milk.id)!.source, "import"); assert.equal(T.subtasks(milk.id).length, 1); ok("importing creates the tasks, subtasks, project and notes");
assert.deepEqual(E.entityTags("note", (db.prepare("SELECT id FROM notes WHERE title='Meeting notes'").get() as any).id), ["q4", "work"]); ok("note tags come across");
r = I.runImport(p); assert.equal(r.tasks + r.subtasks + r.notes, 0); assert.equal(r.skipped, 5); assert.equal((db.prepare("SELECT count(*) c FROM tasks").get() as any).c, before + 4); ok("running the same import twice adds nothing (duplicates are skipped)");
r = I.runImport(I.parseImport([{ name: "g.csv", text: generic }])); assert.equal(r.completed, 1); const w = db.prepare("SELECT id FROM tasks WHERE title='Write report'").get() as any; assert.ok(T.getTask(w.id)!.done_at); ok("rows marked done are imported as completed");
const ex = X.exportAll() as any; assert.equal(ex.version, 2); for (const k of ["notes", "goals", "people", "voice_memos", "item_links", "activity", "columns", "tags", "money", "templates", "task_comments"]) assert.ok(k in ex, "export missing " + k); assert.ok(ex.notes.some((x: any) => Array.isArray(x.tags))); assert.ok(!JSON.stringify(ex.settings).includes("backup_secret")); ok("the JSON export now includes notes, goals, people, memos, links, history, columns, tags and money (secrets still left out)");
console.log(`\n${n} checks passed`);
