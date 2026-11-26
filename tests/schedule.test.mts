// Start dates, "must do today", reminders (several per task, default time, quick add) and the newer repeat rules.
import assert from "node:assert/strict";
const L = (p: string) => import("../src/lib/" + p);
const R = await L("repeat"), P = await L("parse"), T = await L("tasks"), B = await L("browsernotify"), RM = await L("reminders"), S = await L("settings"), D = await L("dates"), { db } = await L("db"), { today } = await L("time");
S.setSetting("timezone", "UTC"); S.setSetting("features", null);
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); };
const t = today(), at = (date: string, hm: string) => new Date(`${date}T${hm}:00Z`); // the test runs in UTC, so local time is UTC

// ---------- repeat rules (pure) ----------
const N = (s: string) => R.normalizeRepeat(s);
assert.equal(N("every Mon, Wed and Fri"), "on:1,3,5"); assert.equal(N("mondays and thursdays"), "on:1,4"); assert.equal(N("every mon wed fri"), "on:1,3,5"); assert.equal(N("Mon-Fri"), "weekdays"); assert.equal(N("mon, tue, wed, thu, fri"), "weekdays");
assert.equal(N("last Friday of the month"), "nth:-1:5"); assert.equal(N("every 2nd tuesday"), "nth:2:2"); assert.equal(N("first weekday of the quarter"), "qwd:1"); assert.equal(N("last working day of the month"), "wd:-1");
assert.equal(N("15th of the month"), "md:15"); assert.equal(N("monthly on the 31st"), "md:31"); assert.equal(N("last day of the month"), "md:-1"); assert.equal(N("3 days after done"), "after:3d"); assert.equal(N("a week after completion"), "after:1w"); assert.equal(N("every 2 months after done"), "after:2m");
assert.equal(N("quarterly"), "3m"); assert.equal(N("fortnightly"), "2w"); assert.equal(N("weekly"), "1w"); assert.equal(N("every 3 days"), "3d"); assert.equal(N("weekdays"), "weekdays"); assert.equal(N(""), null);
assert.throws(() => N("whenever"), /Invalid repeat/); assert.throws(() => N("on:9"), /Invalid repeat/); assert.throws(() => N("md:40"), /Invalid repeat/);
ok("repeat: days of the week, nth weekday, working days, day of month, after done and the old forms all parse; nonsense is refused");
for (const r of ["on:1,3,5", "nth:-1:5", "nth:2:2", "qwd:1", "wd:-1", "md:15", "md:-1", "after:3d", "after:1w", "3m", "2w", "1d", "weekdays"]) assert.equal(R.normalizeRepeat(R.repeatLabel(r)), r, `label of ${r} reads back`);
assert.equal(R.repeatLabel("on:1,4"), "Every Mon and Thu"); assert.equal(R.repeatLabel("nth:-1:5"), "Last Friday of the month"); assert.equal(R.repeatLabel("nth:2:2"), "2nd Tuesday of the month"); assert.equal(R.repeatLabel("after:3d"), "3 days after done"); assert.equal(R.repeatLabel("qwd:1"), "First weekday of the quarter");
ok("repeat: every rule's label reads back as the same rule (the task page shows the label and saves it again)");
const nx = (due: string | null, r: string, on: string) => R.nextRepeatDue(due, r, on);
assert.equal(nx("2026-11-27", "on:1,3,5", "2026-11-27"), "2026-11-30"); assert.equal(nx("2026-11-30", "on:1,3,5", "2026-11-30"), "2026-12-02");
assert.equal(nx("2026-11-27", "nth:-1:5", "2026-11-27"), "2026-12-25"); assert.equal(nx("2026-12-08", "nth:2:2", "2026-12-08"), "2027-01-12");
assert.equal(nx("2027-01-01", "qwd:1", "2027-01-01"), "2027-04-01"); assert.equal(nx("2027-04-01", "qwd:1", "2027-04-01"), "2027-07-01"); assert.equal(nx("2026-11-30", "wd:-1", "2026-11-30"), "2026-12-31");
assert.equal(nx("2027-01-31", "md:31", "2027-01-31"), "2027-02-28"); assert.equal(nx("2027-02-28", "md:31", "2027-02-28"), "2027-03-31"); assert.equal(nx("2027-01-31", "md:-1", "2027-01-31"), "2027-02-28");
assert.equal(nx("2026-01-01", "after:3d", "2026-11-26"), "2026-11-29"); assert.equal(nx(null, "after:2w", "2026-11-26"), "2026-12-10");
assert.equal(nx("2026-10-01", "on:1", "2026-11-26"), "2026-11-30"); assert.equal(nx("2026-12-10", "on:1", "2026-11-26"), "2026-12-14");
assert.equal(nx("2026-11-26", "1w", "2026-11-26"), "2026-12-03"); assert.equal(nx("2026-11-20", "weekdays", "2026-11-26"), "2026-11-27");
ok("repeat: next dates land on the right weekday, last Friday, quarter start, month end (short months too); 'after done' counts from the day it was done; overdue repeats skip ahead");
assert.equal(R.firstRepeatDue("on:1", "2026-11-26"), "2026-11-30"); assert.equal(R.firstRepeatDue("on:4", "2026-11-26"), "2026-11-26"); assert.equal(R.firstRepeatDue("1w", "2026-11-26"), "2026-11-26"); assert.equal(R.firstRepeatDue("after:3d", "2026-11-26"), "2026-11-26");
ok("repeat: a new repeating task with no date starts on the first day the rule lands on (today if it fits)");

// ---------- quick add ----------
const Q = (s: string) => P.parseQuickAdd(s, "2026-11-26"); // a Thursday
let q = Q("Gym every mon wed and fri"); assert.deepEqual([q.title, q.repeat], ["Gym", "on:1,3,5"]);
q = Q("Pay rent every last friday #bills"); assert.deepEqual([q.title, q.repeat, q.tags], ["Pay rent", "nth:-1:5", ["bills"]]);
q = Q("Water plants every 3 days after done"); assert.deepEqual([q.title, q.repeat], ["Water plants", "after:3d"]);
q = Q("Quarterly report every first weekday of the quarter"); assert.equal(q.repeat, "qwd:1");
q = Q("Bins every monday"); assert.deepEqual([q.title, q.repeat, q.due], ["Bins", "on:1", undefined]);
q = Q("Clean filter every 15th"); assert.equal(q.repeat, "md:15");
ok("quick add: 'every mon wed and fri', 'every last friday', 'every 3 days after done', 'every 15th' set the repeat and leave a clean title");
q = Q("Dentist monday 2pm remind me sunday at 7pm"); assert.deepEqual([q.title, q.due, q.due_time, q.reminders], ["Dentist", "2026-11-30", "14:00", [{ date: "2026-11-29", time: "19:00" }]]);
q = Q("Call mum tomorrow at 5pm remind me 30m before"); assert.deepEqual([q.title, q.due, q.due_time, q.reminders], ["Call mum", "2026-11-27", "17:00", [{ before: 30 }]]);
q = Q("Taxes 31 march remind me tomorrow 4pm remind me 2027-03-30 9am"); assert.deepEqual([q.title, q.due, q.reminders], ["Taxes", "2027-03-31", [{ date: "2026-11-27", time: "16:00" }, { date: "2027-03-30", time: "09:00" }]]);
q = Q("Pay invoice remind me 9am"); assert.deepEqual([q.title, q.reminders, q.due], ["Pay invoice", [{ time: "09:00" }], undefined]);
q = Q("Remind Bob about the invoice"); assert.deepEqual([q.title, q.reminders], ["Remind Bob about the invoice", undefined]);
ok("quick add: 'remind me <day> at <time>', 'remind me 30m before' and several reminders are read before the due date; 'Remind Bob…' stays a title");
q = Q("Ship it !focus"); assert.deepEqual([q.title, q.focus], ["Ship it", true]); q = Q("Book flights start:monday"); assert.deepEqual([q.title, q.start_date], ["Book flights", "2026-11-30"]);
q = Q("Renew rego start:2026-12-20 due 2027-01-05"); assert.equal(q.start_date, "2026-12-20"); q = Q("Plan start:in-2-weeks"); assert.equal(q.start_date, "2026-12-10");
ok("quick add: !focus flags it for today; start:<day> sets the start date");

// ---------- start date ----------
const later = T.createTask({ title: "Not yet", due: t, start_date: D.addDays(t, 3) }), now_ = T.createTask({ title: "Now", due: t }), past = T.createTask({ title: "Started", due: t, start_date: D.addDays(t, -1) }), undated = T.createTask({ title: "Inbox later", start_date: D.addDays(t, 2) });
const ids = (rows: any[]) => rows.map((x) => x.id);
assert.ok(!ids(T.queryTasks({ started: true })).includes(later) && ids(T.queryTasks({ started: true })).includes(now_) && ids(T.queryTasks({ started: true })).includes(past));
assert.ok(ids(T.queryTasks()).includes(later), "still listed where nothing asks to hide it (boards, My tasks)"); assert.ok(!ids(T.queryTasks({ inbox: true, started: true })).includes(undated));
assert.ok(ids(T.searchTasks("is:notstarted")).includes(later) && !ids(T.searchTasks("is:notstarted")).includes(now_)); assert.ok(ids(T.searchTasks("Not yet")).includes(later), "search still finds it");
assert.equal(T.notStarted(T.getTask(later)), true); assert.equal(T.notStarted(T.getTask(past)), false);
T.updateTask(later, { start_date: null }); assert.ok(ids(T.queryTasks({ started: true })).includes(later)); T.updateTask(later, { start_date: D.addDays(t, 3) });
ok("start date: hidden from Today/Upcoming/Inbox lists until the day, still on boards and in search, clearable");
const { dailyBrief } = await L("brief"); const brief = await dailyBrief({ network: false });
assert.ok(!brief.due_today.some((x: any) => x.id === later) && brief.due_today.some((x: any) => x.id === now_)); ok("start date: the morning brief leaves out tasks that haven't started");

// ---------- must do today ----------
assert.equal(T.setFocus(now_, true), true); assert.equal(T.getTask(now_).focus_on, t); assert.ok(ids(T.queryTasks({ focus: true })).includes(now_)); assert.ok(T.inFocus(T.getTask(now_)));
assert.ok(ids(T.searchTasks("is:focus")).includes(now_)); const flagged = T.createTask(T.parseQuickAdd("Finish deck !focus")); assert.equal(T.getTask(flagged).focus_on, t);
assert.ok((await dailyBrief({ network: false })).focus.some((x: any) => x.id === now_));
T.setFocus(now_, false); assert.equal(T.getTask(now_).focus_on, null); T.setFocus(now_, true);
ok("focus: flag on and off; quick add !focus; is:focus search; the brief lists today's focus");
const yest = D.addDays(t, -1), old1 = T.createTask({ title: "Left over A" }), old2 = T.createTask({ title: "Left over B" }), doneOld = T.createTask({ title: "Finished yesterday" });
db.prepare("UPDATE tasks SET focus_on=? WHERE id IN (?,?,?)").run(yest, old1, old2, doneOld); T.completeTask(doneOld);
const lo = ids(T.focusLeftovers()); assert.ok(lo.includes(old1) && lo.includes(old2) && !lo.includes(doneOld) && !lo.includes(now_));
assert.equal(T.resolveLeftovers([old1], true), 1); assert.equal(T.getTask(old1).focus_on, t); assert.equal(T.resolveLeftovers([old2], false), 1); assert.equal(T.getTask(old2).focus_on, null); assert.equal(T.getTask(old2).deleted_at, null, "dropping from focus keeps the task");
assert.equal(T.resolveLeftovers([now_], false), 0, "today's flags are not leftovers"); assert.deepEqual(ids(T.focusLeftovers()).filter((x: number) => [old1, old2].includes(x)), []);
ok("focus: unfinished flags from yesterday are offered; carry over moves them to today, drop clears the flag only; finished ones and today's aren't touched");

// ---------- repeating tasks carry their extras forward ----------
const rid = T.createTask({ title: "Gym", repeat: "on:1,3,5", due: D.addDays(t, -2), start_date: D.addDays(t, -4), focus: true });
T.addReminder(rid, { at: `${D.addDays(t, -3)} 18:00` }); T.addReminder(rid, { before: 15 });
const before = T.getTask(rid), r1 = T.completeTask(rid), after = T.getTask(rid), shift = D.diffDays(after.due, before.due);
assert.ok(r1.next_due > t && [1, 3, 5].includes(D.weekday(r1.next_due))); assert.equal(after.start_date, D.addDays(before.start_date, shift)); assert.equal(after.focus_on, null, "the flag was for the finished occurrence");
const rems = T.listReminders(rid); assert.equal(rems.find((x: any) => x.at).at, `${D.addDays(D.addDays(t, -3), shift)} 18:00`); assert.equal(rems.find((x: any) => x.before_min).before_min, 15);
const after3 = T.createTask({ title: "Water plants", repeat: "3 days after done", due: D.addDays(t, -10) }); assert.equal(T.completeTask(after3).next_due, D.addDays(t, 3));
const newOn = T.createTask({ title: "Bins", repeat: "every monday" }); assert.equal(D.weekday(T.getTask(newOn).due), 1); assert.ok(T.getTask(newOn).due >= t);
ok("repeats: completing moves the start date and dated reminders by the same number of days, clears the focus flag; 'after done' counts from today; a new 'every monday' task starts on a Monday");

// ---------- reminders ----------
assert.throws(() => T.addReminder(now_, { at: "tomorrow" }), /date and a time/); const nodate = T.createTask({ title: "No date" }); assert.throws(() => T.addReminder(nodate, { before: 30 }), /due date/);
assert.equal(T.addReminder(999999, { at: `${t} 10:00` }), null); const a1 = T.addReminder(nodate, { at: `${t} 10:00` }), a2 = T.addReminder(nodate, { at: `${t} 10:00` }); assert.equal(a1, a2, "the same reminder twice is one reminder");
const a3 = T.addReminder(nodate, { at: `${t} 16:30` }); assert.equal(T.listReminders(nodate).length, 2);
const due = (h: string, d = t) => B.dueReminders(at(d, h)).filter((x: any) => x.id === nodate);
assert.equal(due("09:59").length, 0); assert.equal(due("10:00").length, 1); assert.equal(due("10:00")[0].kind, "reminder"); assert.match(due("10:00")[0].label, /^Reminder/); assert.equal(due("12:59").length, 1); assert.equal(due("13:01").length, 0); assert.equal(due("16:45").length, 1);
assert.notEqual(due("10:00")[0].token, due("16:45")[0].token, "each reminder notifies on its own");
const tok0 = due("10:40")[0].token; B.snoozeReminder(nodate, 30, at(t, "10:05")); assert.equal(due("10:10").length, 0); assert.equal(due("10:40").length, 1); assert.notEqual(due("10:40")[0].token, tok0, "a new token after the snooze, so it shows again");
db.prepare("DELETE FROM reminder_snooze WHERE task_id=?").run(nodate);
ok("reminders: several per task, each fires at its own time for up to 3 hours, duplicates merge, snooze holds them back, bad input refused");
const rel = T.createTask({ title: "Call", due: t, due_time: "15:00" }); T.addReminder(rel, { before: 60 });
const rr = (h: string) => B.dueReminders(at(t, h)).filter((x: any) => x.id === rel && x.kind === "reminder"); assert.equal(rr("13:59").length, 0); assert.equal(rr("14:00").length, 1);
T.updateTask(rel, { due_time: "17:00" }); assert.equal(rr("14:00").length, 0); assert.equal(rr("16:00").length, 1);
ok("reminders: 'an hour before' follows the task when its time changes");
const spanDay = T.createTask({ title: "Late one", due: D.addDays(t, 1) }); T.addReminder(spanDay, { at: `${t} 23:30` });
assert.equal(B.dueReminders(at(D.addDays(t, 1), "00:30")).filter((x: any) => x.id === spanDay).length, 1); ok("reminders: one set late at night still shows just after midnight");
T.completeTask(nodate); assert.equal(due("10:00").length, 0); ok("reminders: a finished task stops reminding");
const qa = T.createTask(T.parseQuickAdd(`Pay the bill ${D.addDays(t, 2)} remind me ${D.addDays(t, 1)} 4pm remind me 2h before`)); const qr = T.listReminders(qa);
assert.deepEqual(qr.map((x: any) => x.at ?? x.before_min), [`${D.addDays(t, 1)} 16:00`, 120]); ok("reminders: quick add saves them with the task");
S.setSetting("remind_default_time", "08:30"); const dayOnly = T.createTask(T.parseQuickAdd(`Water the garden ${D.addDays(t, 3)} remind me ${D.addDays(t, 2)}`)); assert.equal(T.listReminders(dayOnly)[0].at, `${D.addDays(t, 2)} 08:30`);
ok("reminders: a day with no time uses the default reminder time");

// default-time nudge for dated tasks with no time: off unless switched on
const plain = T.createTask({ title: "Plain dated", due: D.addDays(t, 5) }); db.prepare("UPDATE tasks SET due=? WHERE id=?").run(t, plain);
const dflt = (h: string) => B.dueReminders(at(t, h)).filter((x: any) => x.id === plain);
assert.equal(dflt("08:30").length, 0, "off by default"); S.setSetting("remind_default_on", "1");
assert.equal(dflt("08:29").length, 0); assert.equal(dflt("08:30").length, 1); assert.equal(dflt("08:30")[0].kind, "default");
assert.equal(B.dueReminders(at(t, "08:30")).filter((x: any) => x.id === later).length, 0, "a task that hasn't started isn't nudged"); assert.equal(B.dueReminders(at(t, "08:30")).filter((x: any) => x.id === rel && x.kind === "default").length, 0, "a task with a time uses its time instead");
ok("reminders: with the default switched on, tasks due today with no time remind at that time (not ones that haven't started, or have their own time)");
// the worker's ntfy/webhook/Telegram channel gets them too, once
S.setSetting("ntfy_topic", "lifeos-test-topic"); const sentNotes: any[] = []; const send = async (nt: any) => { sentNotes.push(nt); return { ntfy: "ok" }; };
const T2 = T.createTask({ title: "Worker reminder" }); T.addReminder(T2, { at: `${t} 11:00` });
await RM.runReminders(at(t, "11:01"), send); assert.ok(sentNotes.some((x) => x.title === "Worker reminder" && /^Reminder/.test(x.body)));
const count = sentNotes.length; await RM.runReminders(at(t, "11:05"), send); assert.equal(sentNotes.filter((x) => x.title === "Worker reminder").length, 1, `sent once (${count})`);
ok("reminders: the worker sends them to ntfy / webhook / Telegram once");
S.setSetting("remind_default_on", null); S.setSetting("ntfy_topic", null);

console.log(`${n} checks passed`);
