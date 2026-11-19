import assert from "node:assert/strict";
const L = (p: string) => import("../src/lib/" + p);
const { parseQuickAdd: pq } = await L("parse");
const T = await L("tasks"); const { today, localNow } = await L("time"); const { addDays, addMonths, weekday } = await L("dates");
const H = await L("habits"); const J = await L("journal"); const I = await L("insights"); const E = await L("email");
const R = await L("reminders"); const K = await L("tokens"); const F = await L("features"); const C = await L("ical"); const X = await L("exporter"); const S = await L("settings");
const t = today();
let n = 0; const ok = (name: string) => { n++; console.log("  ✓", name); };

// ---- parser: time + estimate
let p = pq("Call mum tomorrow at 5pm ~30m", t); assert.equal(p.title, "Call mum"); assert.equal(p.due_time, "17:00"); assert.equal(p.estimate, 30); assert.equal(p.due, addDays(t, 1)); ok("parse: at 5pm + ~30m");
p = pq("Standup 9:30am ~1.5h", t); assert.equal(p.due_time, "09:30"); assert.equal(p.estimate, 90); assert.equal(p.due, undefined); const sid2 = T.createTask(p); assert.equal(T.getTask(sid2).due, t); ok("parse: 9:30am + ~1.5h; createTask defaults a timed task to today");
p = pq("Gym at 17:45 weekdays", t); assert.equal(p.due_time, "17:45"); assert.equal(p.repeat, "weekdays"); ok("parse: 24h time");
p = pq("Lunch at noon", t); assert.equal(p.due_time, "12:00"); assert.equal(p.title, "Lunch"); ok("parse: at noon");
p = pq("Read chapter 12:99 notes", t); assert.equal(p.due_time, undefined); ok("parse: invalid time ignored");
p = pq("Plan 2026-12-01 ~45", t); assert.equal(p.estimate, 45); assert.equal(p.due, "2026-12-01"); ok("parse: bare ~45 = minutes");

p = pq("Renew passport 31 march at 9am", t); assert.equal(p.title, "Renew passport"); assert.match(p.due!, /^\d{4}-03-31$/); assert.ok(p.due! >= t); assert.equal(p.due_time, "09:00"); ok("parse: 31 march (next occurrence)");
p = pq("File taxes march 31st 2031", t); assert.equal(p.due, "2031-03-31"); assert.equal(p.title, "File taxes"); ok("parse: march 31st 2031 (explicit year)");
p = pq("Party on 5th of December", t); assert.match(p.due!, /^\d{4}-12-05$/); assert.equal(p.title, "Party"); ok("parse: 5th of December");
p = pq("Odd 31 feb thing", t); assert.equal(p.due, undefined); assert.equal(p.title, "Odd 31 feb thing"); ok("parse: impossible date (31 feb) left alone");
p = pq("Plan retro next week", t); assert.equal(weekday(p.due!), 1); assert.ok(p.due! > t); assert.equal(p.title, "Plan retro"); ok("parse: next week -> next Monday");
p = pq("Renew licence next month", t); assert.equal(p.due, addMonths(t, 1)); ok("parse: next month");
p = pq("Buy may flowers", t); assert.equal(p.due, undefined); ok("parse: bare month word is not a date");

// ---- subtasks
const parent = T.createTask({ title: "Pack for trip", project: "Travel", repeat: "weekly" });
const s1 = T.createTask({ title: "Passport", parent_id: parent }), s2 = T.createTask({ title: "Charger", parent_id: parent });
assert.equal(T.getTask(s1).project_name, "Travel"); assert.equal(T.getTask(parent).sub_total, 2);
assert.ok(!T.queryTasks().some((x: any) => x.id === s1)); assert.equal(T.queryTasks({ parent }).length, 2); ok("subtasks: inherit project, hidden from top-level, counted");
T.completeTask(s1); assert.equal(T.getTask(parent).sub_done, 1);
T.completeTask(parent); // repeating: children reset
assert.equal(T.getTask(parent).sub_done, 0); assert.equal(T.getTask(parent).done_at, null); ok("subtasks: recurring parent resets its checklist");
const p2 = T.createTask({ title: "One-off", }); const c1 = T.createTask({ title: "a", parent_id: p2 }); T.completeTask(p2);
assert.ok(T.getTask(c1).done_at); ok("subtasks: completing parent completes children");

// ---- soft delete / restore / duplicate
const d1 = T.createTask({ title: "Temp", tags: ["x"] }); const dc = T.createTask({ title: "kid", parent_id: d1 });
assert.ok(T.deleteTask(d1)); assert.equal(T.getTask(d1), undefined); assert.equal(T.getTask(dc), undefined);
assert.ok(T.restoreTask(d1)); assert.ok(T.getTask(d1)); assert.ok(T.getTask(dc)); ok("soft delete + restore (children too)");
const dup = T.duplicateTask(d1)!; assert.notEqual(dup, d1); assert.equal(T.getTask(dup).sub_total, 1); assert.deepEqual(T.getTask(dup).tags, ["x"]); ok("duplicate copies tags + subtasks");

// ---- reschedule
const r = T.createTask({ title: "Move me", due: t }); T.reschedule(r, "tomorrow"); assert.equal(T.getTask(r).due, addDays(t, 1));
T.reschedule(r, "nextweek"); assert.equal(weekday(T.getTask(r).due), 1); T.reschedule(r, "weekend"); assert.equal(weekday(T.getTask(r).due), 6);
T.reschedule(r, "none"); assert.equal(T.getTask(r).due, null); assert.throws(() => T.reschedule(r, "someday-ish")); ok("reschedule presets (next Mon / Sat / none) + validation");

// ---- search
T.createTask({ title: "Invoice for Acme", tags: ["bills"], project: "Work", due: t, notes: "see https://acme.test/inv" });
T.createTask({ title: "Buy milk", due: addDays(t, 3) }); const dn = T.createTask({ title: "Old invoice" }); T.completeTask(dn);
const ids = (q: string) => T.searchTasks(q).map((x: any) => x.title).sort();
assert.deepEqual(ids("invoice"), ["Invoice for Acme"]); assert.deepEqual(ids("invoice is:any"), ["Invoice for Acme", "Old invoice"]);
assert.deepEqual(ids("#bills @work due:today"), ["Invoice for Acme"]); assert.deepEqual(ids("due:week milk"), ["Buy milk"]);
assert.ok(ids("has:link").includes("Invoice for Acme")); assert.ok(ids("is:done").includes("Old invoice") && !ids("is:done").includes("Buy milk")); assert.deepEqual(ids("100%"), []);
assert.ok(ids("no:date").includes("Temp")); ok("search operators (#tag @project due: is: has: no:) + LIKE escaping");

// ---- habits
const h = H.createHabit("Read", { days: [0, 1, 2, 3, 4, 5, 6] });
for (let i = 1; i <= 3; i++) H.toggleHabit(h, addDays(t, -i));
let st = H.habitStats(H.getHabit(h), t); assert.equal(st.streak, 3); ok("habit: streak holds when today not yet done");
H.toggleHabit(h, t); st = H.habitStats(H.getHabit(h), t); assert.equal(st.streak, 4); assert.equal(st.best, 4);
H.toggleHabit(h, addDays(t, -2)); st = H.habitStats(H.getHabit(h), t); assert.equal(st.streak, 2); ok("habit: gap breaks streak; best preserved");
assert.equal(H.toggleHabit(h, t)!.done, false); assert.equal(H.habitsToday().find((x: any) => x.id === h).done, false); ok("habit: toggle off");
const wk = H.createHabit("Gym", { days: [1, 3, 5] }); // Mon/Wed/Fri, skipping other days must not break the streak
const mons: string[] = []; for (let i = 0; i < 21; i++) { const d = addDays(t, -i); if ([1, 3, 5].includes(weekday(d))) mons.push(d); }
for (const d of mons) H.toggleHabit(wk, d); assert.equal(H.habitStats(H.getHabit(wk), t).streak, mons.length); ok("habit: unscheduled days are skipped, not breaks");

// ---- journal
J.saveEntry(t, { mood: 4, body: "Good day" }); J.saveEntry(t, { body: "Great day" }); assert.equal(J.getEntry(t).mood, 4); assert.equal(J.getEntry(t).body, "Great day");
assert.equal(J.listEntries({ q: "great" }).length, 1); assert.equal(J.moodSeries(7).at(-1).mood, 4); assert.ok(J.journalStreak() >= 1); ok("journal: upsert keeps mood, search, series, streak");

// ---- insights
const ins = I.insights(t); assert.ok(ins.thisWeek >= 3); assert.equal(ins.heat.length, 182); assert.ok(ins.streak >= 1); assert.ok(ins.habits.length >= 2); ok("insights: heatmap, week totals, streak, habits");

// ---- email import
const e1 = E.importEmail({ from: "Ann <ann@x.test>", to: "tasks+work@me.test", subject: "Fwd: Re: Pay invoice tomorrow #bills !high", messageId: "<m1@x>", text: "Please pay by Friday.\n\nOn Mon, Bob wrote:\n> old stuff\n-- \nsig" });
const et = T.getTask(e1.id); assert.equal(et.title, "Pay invoice"); assert.equal(et.due, addDays(t, 1)); assert.equal(et.priority, 1);
assert.deepEqual(et.tags.sort(), ["bills", "email", "work"]); assert.equal(et.source, "email"); assert.ok(et.notes.includes("From: Ann")); assert.ok(!et.notes.includes("old stuff")); assert.ok(!et.notes.includes("sig"));
assert.equal(E.importEmail({ messageId: "<m1@x>", subject: "again" }).duplicate, true);
const e2 = E.importEmail({ subject: "", html: "<p>Hello&nbsp;<b>world</b></p><style>x{}</style>", messageId: "<m2@x>" }); assert.equal(T.getTask(e2.id).title, "(no subject)"); assert.ok(T.getTask(e2.id).notes.includes("Hello world")); ok("email import: clean subject/body, quick-add syntax, +tag, dedupe, html fallback");

// ---- tokens
const tok = K.createToken("bot"); assert.ok(tok.startsWith("lifeos_")); assert.ok(K.verifyBearer(`Bearer ${tok}`)); assert.ok(!K.verifyBearer("Bearer nope")); assert.ok(!K.verifyBearer(undefined));
assert.equal(K.listTokens()[0].prefix, tok.slice(0, 12)); assert.ok(K.revokeToken(K.listTokens()[0].id)); assert.ok(!K.verifyBearer(`Bearer ${tok}`)); ok("tokens: hashed, verify, revoke");

// ---- features
assert.equal(F.isOn("habits"), true); F.setFeature("habits", false); assert.equal(F.isOn("habits"), false); assert.equal(F.featureMap().habits, false); assert.equal(F.featureMap().journal, true); F.setFeature("habits", true); ok("features: toggle on/off");

// ---- reminders (fake channel)
const { hm, date } = localNow(); const cur = +hm.slice(0, 2) * 60 + +hm.slice(3);
T.createTask({ title: "Dentist call", due: date, due_time: hm, estimate: 15 });
const sentNotes: any[] = []; const fake = async (n: any) => { sentNotes.push(n); return { ntfy: "ok" }; };
assert.equal(await R.runReminders(new Date(), fake), 0); ok("reminders: nothing sent when no channel configured");
S.setSetting("ntfy_topic", "t"); S.setSetting("brief_time", cur >= 10 ? `${String(Math.floor((cur - 10) / 60)).padStart(2, "0")}:${String((cur - 10) % 60).padStart(2, "0")}` : "00:00");
const sentN = await R.runReminders(new Date(), fake); assert.ok(sentNotes.some((x) => x.title === "Dentist call" && x.body.includes("~15m"))); assert.ok(sentNotes.some((x) => /Good morning/.test(x.title))); assert.ok(sentN >= 2);
assert.equal(await R.runReminders(new Date(), fake), 0); ok("reminders: due-time + morning brief sent once, deduped on re-run");
F.setFeature("reminders", false); T.createTask({ title: "Another", due: date, due_time: hm }); assert.equal(await R.runReminders(new Date(), fake), 0); F.setFeature("reminders", true); ok("reminders: respects the feature switch");
const failing = async () => ({ ntfy: "HTTP 500" }); T.createTask({ title: "Retry me", due: date, due_time: hm }); assert.equal(await R.runReminders(new Date(), failing), 0); assert.ok(await R.runReminders(new Date(), fake) >= 1); ok("reminders: failed sends are retried, not lost");

// ---- ics
const ics = C.buildIcs("https://x.test"); assert.ok(ics.startsWith("BEGIN:VCALENDAR")); assert.ok(ics.includes("RRULE:FREQ=WEEKLY;INTERVAL=1")); assert.ok(/DTSTART:\d{8}T\d{6}/.test(ics)); assert.ok(/DTSTART;VALUE=DATE:\d{8}/.test(ics)); assert.ok(ics.includes("CATEGORIES:bills"));
assert.ok(ics.split("\r\n").every((l: string) => Buffer.byteLength(l) <= 75)); ok("ics: all-day + timed events, RRULE, categories, line folding");

// ---- export: secrets excluded
S.setSetting("spotify_refresh", "SECRET"); S.setSetting("ntfy_token", "SECRET2"); const ex = X.exportAll(); assert.ok(!JSON.stringify(ex).includes("SECRET")); assert.ok(ex.tasks.length > 5); assert.ok(X.tasksCsv().split("\n")[0].startsWith("id,parent_id,title")); ok("export: JSON + CSV, secrets excluded");
console.log(`\n${n} checks passed`);
