import assert from "node:assert/strict";
import http from "node:http";
const L = (p: string) => import("../src/lib/" + p);
const Cal = await L("calendar"), P = await L("planner"), MD = await L("markdown"), N = await L("notes"), G = await L("goals"), TP = await L("templates"), X = await L("misc"), T = await L("tasks"), { db } = await L("db"), S = await L("settings"), { today } = await L("time"), D = await L("dates");
S.setSetting("timezone", "Pacific/Auckland"); process.env.LIFEOS_ALLOW_PRIVATE_FETCH = "1";
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); }; const t = today();

// ---- calendar: expansion (pure)
const ICS = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//t//EN\r\nBEGIN:VEVENT\r\nUID:weekly1\r\nDTSTART:20261116T020000Z\r\nDTEND:20261116T030000Z\r\nRRULE:FREQ=WEEKLY;COUNT=6\r\nEXDATE:20261123T020000Z\r\nSUMMARY:Team sync\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:allday1\r\nDTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261121\r\nSUMMARY:Public holiday\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:multi\r\nDTSTART;VALUE=DATE:20261125\r\nDTEND;VALUE=DATE:20261128\r\nSUMMARY:Conference\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:single\r\nDTSTART:20261119T040000Z\r\nDTEND:20261119T050000Z\r\nSUMMARY:Dentist\r\nLOCATION:Main St\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const ev = Cal.expandIcs(ICS, "2026-11-10", "2027-01-31"); const sync = ev.filter((e: any) => e.title === "Team sync");
assert.deepEqual(sync.map((e: any) => e.date), ["2026-11-16", "2026-11-30", "2026-12-07", "2026-12-14", "2026-12-21"]); assert.equal(sync[0].start_time, "15:00"); assert.equal(sync[0].end_time, "16:00"); ok("calendar: weekly recurrence expanded, EXDATE honoured, converted to local time");
const hol = ev.find((e: any) => e.title === "Public holiday"); assert.deepEqual([hol.date, hol.all_day, hol.start_time], ["2026-11-20", 1, null]); const conf = ev.find((e: any) => e.title === "Conference"); assert.deepEqual([conf.date, conf.end_date], ["2026-11-25", "2026-11-27"]); ok("calendar: all-day and multi-day (inclusive end) events");
const den = ev.find((e: any) => e.title === "Dentist"); assert.equal(den.date, "2026-11-19"); assert.equal(den.start_time, "17:00"); assert.equal(den.location, "Main St"); ok("calendar: timed single event with location");
assert.equal(Cal.expandIcs(ICS, "2027-02-01", "2027-03-01").length, 0); ok("calendar: events outside the window excluded");

// ---- calendar: sync from a URL (stub server), error handling
const srv = http.createServer((req, res) => { if (req.url === "/ok.ics") { res.writeHead(200, { "content-type": "text/calendar" }).end(ICS); } else if (req.url === "/html") res.writeHead(200).end("<html>nope</html>"); else res.writeHead(404).end(); }).listen(4666);
await new Promise((r) => setTimeout(r, 200));
const fid = Cal.addFeed("Work", "http://127.0.0.1:4666/ok.ics", "#8b5cf6"); const sy = await Cal.syncFeed(fid, "2026-11-19"); assert.ok(sy.events >= 8 && !sy.error); assert.equal(Cal.eventsOn("2026-11-19").some((e: any) => e.title === "Dentist"), true);
assert.equal(Cal.eventsOn("2026-11-26").some((e: any) => e.title === "Conference"), true); assert.equal(Cal.eventsOn("2026-11-24").some((e: any) => e.title === "Team sync"), false); ok("calendar: sync from URL stores events; eventsOn spans multi-day, skips the excluded date");
const bad = Cal.addFeed("Bad", "http://127.0.0.1:4666/html"); assert.match((await Cal.syncFeed(bad, "2026-11-19")).error, /isn't an iCalendar/); const four = Cal.addFeed("Gone", "http://127.0.0.1:4666/missing"); assert.match((await Cal.syncFeed(four)).error, /404/); assert.ok(Cal.listFeeds().find((f: any) => f.id === four).last_error); ok("calendar: non-ICS and 404 feeds report a clear error, don't wipe good data");
assert.ok(Cal.eventsOn("2026-11-19").length > 0); delete process.env.LIFEOS_ALLOW_PRIVATE_FETCH; assert.throws(() => Cal.addFeed("local", "http://127.0.0.1/x.ics")); process.env.LIFEOS_ALLOW_PRIVATE_FETCH = "1"; ok("calendar: private addresses blocked unless explicitly allowed");

// ---- planner
let day = D.addDays(t, 3); while (D.weekday(day) === 1) day = D.addDays(day, 1); /* not a Monday: the fixture calendar has a weekly Monday meeting */ S.setSetting("work_start", "09:00"); S.setSetting("work_end", "12:00");
db.prepare("INSERT INTO cal_events (feed_id, uid, title, date, start_time, end_time, all_day) VALUES (?,?,?,?,?,?,0)").run(fid, "pl1", "Standup", day, "09:30", "10:00");
const a = T.createTask({ title: "Write report", due: day, due_time: "10:00", estimate: 60 }); const u1 = T.createTask({ title: "Big one", due: day, estimate: 90, priority: 1 }), u2 = T.createTask({ title: "Small", due: day, estimate: 15 }), u3 = T.createTask({ title: "No estimate", due: day }), u4 = T.createTask({ title: "Huge", due: day, estimate: 240 });
const blocks = P.dayBlocks(day).blocks; assert.deepEqual(blocks.map((b: any) => [b.title, b.start, b.end]), [["Standup", 570, 600], ["Write report", 600, 660]]); ok("planner: timed tasks sized by estimate + calendar events, ordered");
assert.deepEqual(P.freeSlots(day, 540, 720), [[540, 570], [660, 720]]); ok("planner: free gaps exclude events and tasks");
assert.equal(P.findSlot(day, 30), 540); assert.equal(P.findSlot(day, 45), 660); assert.equal(P.findSlot(day, 90), null); ok("planner: findSlot picks the first gap that fits");
const clash = T.createTask({ title: "Clash", due: day, due_time: "09:45", estimate: 30 }); assert.ok(P.dayBlocks(day).blocks.find((b: any) => b.title === "Clash").conflict); T.deleteTask(clash); ok("planner: overlapping blocks flagged as conflicts");
const as = P.autoSchedule(day, "1900-01-01");
assert.ok(as.scheduled.length >= 2 && as.leftover.some((l: any) => l.title === "Huge")); const placed = Object.fromEntries(as.scheduled.map((s: any) => [s.title, s.time])); assert.equal(placed["Big one"] === undefined, true, "90m doesn't fit the only gaps (30m and 60m)");
assert.ok(placed["Small"]); assert.ok(placed["No estimate"]); const after = P.dayBlocks(day).blocks; for (const b of after) assert.ok(!b.conflict, `${b.title} conflicts`); ok("planner: autoSchedule packs what fits, reports what doesn't, creates no conflicts");
assert.equal(P.unscheduled(day, "1900-01-01").every((x: any) => !x.due_time), true); ok("planner: unscheduled list excludes timed tasks");

// ---- markdown
const html = MD.renderMarkdown("# Title\n\nSome **bold**, *it*, `code <b>` and [[Other]] plus [[task:5]].\n\n- a\n- [x] done\n- [ ] todo\n\n> quote\n\n```\n<script>alert(1)</script>\n```\n\n<img src=x onerror=alert(1)>\n[bad](javascript:alert(1)) [ok](https://e.com?a=1&b=2)", (x: string) => (x === "Other" ? 7 : null));
assert.match(html, /<h2>Title<\/h2>/); assert.match(html, /<strong>bold<\/strong>/); assert.match(html, /<code>code &lt;b&gt;<\/code>/); assert.match(html, /href="\/notes\/7"/); assert.match(html, /href="\/tasks\/5"/); assert.match(html, /md-task/); assert.match(html, /<blockquote>quote/);
const stripped = html.replace(/<\/?(h\d|p|strong|em|code|a|ul|ol|li|blockquote|pre|input|span|del|hr|br)\b[^>]*>/g, ""); assert.ok(!stripped.includes("<"), "unexpected raw tag left: " + stripped); assert.ok(!/<a [^>]*href="javascript/i.test(html)); assert.ok(!/<(script|img|iframe|svg|style)/i.test(html)); assert.match(html, /&lt;script&gt;/); assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.ok(!/href="javascript/.test(html)); assert.match(html, /href="https:\/\/e\.com\?a=1&amp;b=2"/); ok("markdown: formatting, [[wiki]] + [[task:N]] links, and every HTML/JS injection attempt neutralised");
assert.match(MD.renderMarkdown("[[Missing]]"), /notes\/new\?title=Missing/); ok("markdown: link to a missing note offers to create it");

// ---- notes
const n1 = N.createNote("Projects", "Alpha"), n2 = N.createNote("Alpha", "See [[Projects]] for context"), n3 = N.createNote("Ideas", "nothing"); N.updateNote(n3, { pinned: true });
assert.equal(N.listNotes()[0].id, n3); assert.deepEqual(N.backlinks(N.getNote(n1)).map((x: any) => x.id), [n2]); assert.equal(N.listNotes({ q: "context" }).length, 1); assert.equal(N.resolver()("PROJECTS"), n1); N.deleteNote(n3); assert.equal(N.getNote(n3), undefined); N.restoreNote(n3); assert.ok(N.getNote(n3)); ok("notes: pin order, backlinks, search, case-insensitive resolve, delete/restore");

// ---- goals
const proj = Number(db.prepare("INSERT INTO projects (name) VALUES ('Goal project')").run().lastInsertRowid);
const g = G.createGoal({ title: "Run a 10k", area: "Health", target_date: D.addDays(t, 60), project_id: proj }); assert.equal(G.goalProgress(G.getGoal(g)).pct, 0);
const k1 = T.createTask({ title: "Train", project_id: proj }), k2 = T.createTask({ title: "Buy shoes", project_id: proj }); T.completeTask(k1); assert.equal(G.goalProgress(G.getGoal(g)).pct, 50);
const kr = G.addKeyResult(g, "Weekly km", 40, "km"); G.setKeyResult(kr, 10); assert.equal(G.goalProgress(G.getGoal(g)).pct, Math.round(((0.5 + 0.25) / 2) * 100)); G.setKeyResult(kr, 400); assert.equal(G.goalProgress(G.getGoal(g)).krPct, 100); ok("goals: progress blends project tasks and key results, capped at 100%");
assert.throws(() => G.addKeyResult(g, "bad", 0)); G.setGoalStatus(g, "done"); assert.equal(G.goalProgress(G.getGoal(g)).pct, 100); assert.equal(G.listGoals().length, 0); ok("goals: validation, done goals leave the active list at 100%");
G.createGoal({ title: "Save more", area: "Money" }); assert.equal(G.areaBalance().find((a: any) => a.area === "Money").goals, 1); ok("goals: life-area balance");

// ---- templates
assert.equal(TP.installStarterTemplates(), 4); assert.equal(TP.installStarterTemplates(), 0); const tpl = TP.listTemplates().find((x: any) => x.name === "Trip packing list"); const tid = TP.useTemplate(tpl.id, { due: D.addDays(t, 3) }); assert.equal(T.getTask(tid).due, D.addDays(t, 3)); assert.equal(T.getTask(tid).sub_total, 7); assert.deepEqual(T.getTask(tid).tags, ["travel"]); ok("templates: starters install once; use creates task + subtasks with the chosen date");
const wk = TP.listTemplates().find((x: any) => x.name === "Weekly review"); const wid = TP.useTemplate(wk.id); assert.equal(T.getTask(wid).repeat, "1w"); assert.equal(T.getTask(wid).due, t); ok("templates: repeat carried over, repeating template defaults to today");
const src = T.createTask({ title: "Onboard hire", tags: ["work"], estimate: 120 }); T.createTask({ title: "Laptop", parent_id: src }); T.createTask({ title: "Accounts", parent_id: src }); const nt = TP.templateFromTask(src, "Onboarding"); assert.deepEqual(TP.getTemplate(nt).data.subtasks, ["Laptop", "Accounts"]); assert.throws(() => TP.createTemplate("", { title: "x", subtasks: [] })); ok("templates: save an existing task (with subtasks) as a template");

// ---- misc: trash, filters, comments, link title, quiet, do-now, matrix
const del = T.createTask({ title: "Trash me" }); T.deleteTask(del); assert.ok(X.listTrash().some((x: any) => x.id === del)); assert.equal(X.purgeTask(del), true); assert.equal(X.listTrash().some((x: any) => x.id === del), false); const d2 = T.createTask({ title: "Trash 2" }); T.deleteTask(d2); assert.ok(X.emptyTrash() >= 1); assert.equal(X.purgeTask(T.createTask({ title: "live" })), false); ok("trash: list, purge forever, empty — live tasks can't be purged");
const fl = X.saveFilter("Work due", "#work due:week"); assert.equal(X.listFilters()[0].query, "#work due:week"); assert.throws(() => X.saveFilter("", "x")); X.deleteFilter(fl); assert.equal(X.listFilters().length, 0); ok("saved filters");
const cm = X.addComment(a, "Called them"); assert.equal(X.listComments(a)[0].body, "Called them"); assert.throws(() => X.addComment(a, "  ")); X.deleteComment(cm); assert.equal(X.listComments(a).length, 0); ok("comments");
assert.equal(X.titleFromHtml('<html><head><title>Hello &amp; World</title></head>'), "Hello & World"); assert.equal(X.titleFromHtml('<meta property="og:title" content="OG Title"><title>x</title>'), "OG Title");
const page = http.createServer((q, r) => { r.writeHead(200, { "content-type": "text/html" }).end('<html><head><title>Great Article</title></head><body>hi</body></html>'); }).listen(4667); await new Promise((r) => setTimeout(r, 150));
const lt = T.createTask({ title: "http://127.0.0.1:4667/post", notes: "" }); assert.equal(await X.enrichLinkTask(lt), true); assert.equal(T.getTask(lt).title, "Great Article"); assert.match(T.getTask(lt).notes, /127\.0\.0\.1:4667\/post/); const keep = T.createTask({ title: "Read http://127.0.0.1:4667/x later" }); assert.equal(await X.enrichLinkTask(keep), false); assert.equal(T.getTask(keep).title, "Read http://127.0.0.1:4667/x later"); ok("link titles: bare-URL tasks get the page title (URL kept in notes); real titles untouched");
assert.equal(await X.enrichLinkTask(99999), false); const dead = T.createTask({ title: "http://127.0.0.1:1/none" }); assert.equal(await X.enrichLinkTask(dead), false); ok("link titles: unreachable pages fail quietly");
assert.equal(X.inQuietHours("23:30", "22:00", "07:00"), true); assert.equal(X.inQuietHours("06:59", "22:00", "07:00"), true); assert.equal(X.inQuietHours("07:00", "22:00", "07:00"), false); assert.equal(X.inQuietHours("13:00", "12:00", "14:00"), true); assert.equal(X.inQuietHours("12:00", "", ""), false); ok("quiet hours: overnight and same-day windows");
const od = T.createTask({ title: "Overdue high", due: D.addDays(t, -3), priority: 1 }), later = T.createTask({ title: "Someday", due: D.addDays(t, 20) }); assert.equal(X.nextBest([], t).id, od); assert.notEqual(X.nextBest([od], t).id, od); ok("do-now: overdue high-priority first; skipping moves on");
const m = X.matrix([T.getTask(od), T.getTask(later), T.getTask(T.createTask({ title: "Hi later", priority: 1, due: D.addDays(t, 30) })), T.getTask(T.createTask({ title: "Soon plain", due: t }))], t); assert.deepEqual([m.doNow.length, m.schedule.length, m.delegate.length, m.drop.length], [1, 1, 1, 1]); ok("matrix: four quadrants");
srv.close(); page.close(); console.log(`\n${n} checks passed`); process.exit(0);
// regression: a birthday without a year must not break the calendar feed
