// Web Push: keys, device storage, sending (with a fake push service), and reminders delivered by push alongside ntfy/webhook.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import webpush from "web-push";
const L = (p: string) => import("../src/lib/" + p);
const W = await L("webpush"); const R = await L("reminders"); const T = await L("tasks"); const S = await L("settings"); const F = await L("features"); const B = await L("browsernotify");
const { localNow } = await L("time"); const { db } = await L("db");
let n = 0; const ok = (name: string) => { n++; console.log("  ✓", name); };

// A real browser-shaped subscription: an uncompressed P-256 public key and a 16-byte auth secret, base64url.
const fakeSub = (host = "fcm.googleapis.com") => { const e = crypto.createECDH("prime256v1"); e.generateKeys(); return { endpoint: `https://${host}/fcm/send/${crypto.randomBytes(12).toString("hex")}`, keys: { p256dh: e.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") } }; };
const clear = () => db.prepare("DELETE FROM push_subscriptions").run();

// ---- keys
const k1 = W.vapidKeys(), k2 = W.vapidKeys();
assert.equal(k1.publicKey, k2.publicKey); assert.equal(k1.privateKey, k2.privateKey); assert.equal(Buffer.from(k1.publicKey, "base64url").length, 65); ok("server keys are made once and then reused");

// ---- storing devices
const a = fakeSub(), id = W.saveSubscription(a, "Chrome on Mac");
assert.equal(W.listDevices().length, 1); assert.equal(W.listDevices()[0].label, "Chrome on Mac"); assert.ok(W.pushConfigured()); ok("a device's subscription is stored with its name");
assert.equal(W.saveSubscription({ ...a, keys: { ...a.keys } }, ""), id); assert.equal(W.listDevices().length, 1); assert.equal(W.listDevices()[0].label, "Chrome on Mac"); ok("saving the same device again updates it, and an empty name keeps the old one");
const rotated = fakeSub(); W.saveSubscription(rotated, "", a.endpoint);
assert.equal(W.listDevices().length, 1); assert.equal(W.listDevices()[0].endpoint, rotated.endpoint); assert.equal(W.listDevices()[0].label, "Chrome on Mac"); ok("a subscription the browser replaced takes the old one's place and name");
for (const bad of [{ ...fakeSub(), endpoint: "http://fcm.googleapis.com/x" }, { ...fakeSub(), endpoint: "https://127.0.0.1/x" }, { ...fakeSub(), endpoint: "https://192.168.1.10/x" }, { ...fakeSub(), endpoint: "https://localhost/x" }, { ...fakeSub(), endpoint: "not a url" }])
  assert.throws(() => W.saveSubscription(bad, "x"), /push subscription/);
ok("endpoints that aren't public https addresses are refused (the server never calls your own network)");
assert.throws(() => W.saveSubscription({ endpoint: fakeSub().endpoint, keys: { p256dh: "short", auth: "x" } }, "x"), /keys/); assert.throws(() => W.saveSubscription({}, "x")); ok("missing or malformed keys are refused");
W.saveSubscription(fakeSub(), "  lots   of\n spaces " + "x".repeat(100)); assert.ok(W.listDevices().every((d: any) => d.label.length <= 60 && !/\s\s/.test(d.label))); ok("device names are tidied and capped");
assert.ok(W.isKnownEndpoint(rotated.endpoint)); assert.ok(!W.isKnownEndpoint(a.endpoint)); ok("known endpoints can be checked (for the page's daily re-send)");
clear(); for (let i = 0; i < 20; i++) W.saveSubscription(fakeSub(), `d${i}`); assert.throws(() => W.saveSubscription(fakeSub(), "one too many"), /20 devices/); ok("at most 20 devices");
clear();

// ---- sending
const calls: any[] = [];
const sender = (status: (endpoint: string) => number) => async (sub: any, body: string, opts: any) => { calls.push({ sub, body: JSON.parse(body), opts }); const s = status(sub.endpoint); if (s >= 400) throw Object.assign(new Error(`Received unexpected response code`), { statusCode: s }); return { statusCode: s }; };
const good = fakeSub(), gone = fakeSub(), flaky = fakeSub("updates.push.services.mozilla.com");
W.saveSubscription(good, "good"); W.saveSubscription(gone, "gone"); W.saveSubscription(flaky, "flaky");
let r = await W.sendPush({ title: "x".repeat(500), body: "y".repeat(2000), tag: "task-1", id: 1, actions: true, priority: 4 }, { send: sender((e) => (e === good.endpoint ? 201 : e === gone.endpoint ? 410 : 503)) });
assert.deepEqual([r.sent, r.failed, r.removed], [1, 2, 1]); ok("sends to every device and counts what was delivered");
assert.deepEqual(W.listDevices().map((d: any) => d.label).sort(), ["flaky", "good"]); ok("a device the push service says is gone (410) is removed");
const fl = W.listDevices().find((d: any) => d.label === "flaky"); assert.equal(fl.fails, 1); assert.match(fl.last_error, /503/); assert.ok(W.listDevices().find((d: any) => d.label === "good").last_ok); ok("other failures are recorded on the device, which is kept (an outage never removes it)");
for (let i = 0; i < 30; i++) await W.sendPush({ title: "again" }, { send: sender(() => 503) }); assert.equal(W.listDevices().length, 2); ok("even many failures in a row don't remove a device");
const c0 = calls[0]; assert.ok(c0.body.title.length <= 200 && c0.body.body.length <= 800); assert.equal(c0.body.tag, "task-1"); assert.equal(c0.opts.urgency, "high"); assert.equal(c0.opts.vapidDetails.publicKey, k1.publicKey); ok("long text is clipped to fit a push, and reminders go as high urgency with this server's keys");
calls.length = 0; await W.sendPush({ title: "only one" }, { ids: [W.listDevices().find((d: any) => d.label === "good").id], send: sender(() => 201) }); assert.equal(calls.length, 1); assert.equal(calls[0].sub.endpoint, good.endpoint); ok("can send to one chosen device (Send a test)");
// The real library must accept what we store and produce an encrypted request for it.
const req = webpush.generateRequestDetails(good, JSON.stringify({ title: "hi" }), { vapidDetails: { subject: "mailto:lifeos@localhost", publicKey: k1.publicKey, privateKey: k1.privateKey }, TTL: 60 });
assert.equal(req.endpoint, good.endpoint); assert.equal(req.headers["Content-Encoding"], "aes128gcm"); assert.match(String(req.headers.Authorization), /^vapid t=.+, k=/); assert.ok((req.body as Buffer).length > 0); ok("stored subscriptions encrypt with the real web-push library (aes128gcm + VAPID)");
assert.equal(W.removeEndpoint(flaky.endpoint), true); assert.equal(W.listDevices().length, 1); ok("a device can turn itself off by endpoint");

// ---- reminders by push
// Midday today (same date, so "today" still means today), so the checks never straddle midnight whenever the suite runs.
const real = new Date(), rhm = localNow(real).hm, now = new Date(real.getTime() + (720 - (+rhm.slice(0, 2) * 60 + +rhm.slice(3))) * 60_000);
const { date, hm } = localNow(now), cur = +hm.slice(0, 2) * 60 + +hm.slice(3);
const at = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String((((m % 1440) + 1440) % 1440) % 60).padStart(2, "0")}`;
S.setSetting("brief_time", at(cur + 240)); // well away from now: no brief during the task checks
const pushed: any[] = []; const fakePush = async (p: any, o: any) => { pushed.push({ p, o }); return { sent: 1, failed: 0, removed: 0, errors: [] }; };
const noClassic = async () => { throw new Error("ntfy/webhook must not be called"); };
const task = T.createTask({ title: "Call the plumber", due: date, due_time: hm, project: "Home" });
assert.equal(await R.runReminders(now, noClassic, fakePush), 1);
const p0 = pushed[0].p; assert.equal(p0.title, "Call the plumber"); assert.equal(p0.tag, `task-${task}`); assert.equal(p0.id, task); assert.equal(p0.actions, true); assert.match(p0.url, new RegExp(`/tasks/${task}\\?reminder=1$`)); assert.match(p0.body, /Home/); assert.equal(pushed[0].o.ttl, 7200);
ok("with only push set up, a due task is pushed with Mark done/Snooze, the same tag as the in-tab pop-up, and a link that opens it");
assert.equal(await R.runReminders(now, noClassic, fakePush), 0); ok("each reminder is pushed once");
const later = new Date(now.getTime() + 5 * 60_000);
B.snoozeReminder(task, 15, now); assert.equal(await R.runReminders(later, noClassic, fakePush), 0); ok("a snoozed task stays quiet during the snooze");
const afterSnooze = new Date(now.getTime() + 16 * 60_000); pushed.length = 0;
assert.equal(await R.runReminders(afterSnooze, noClassic, fakePush), 1); assert.equal(pushed[0].p.id, task); ok("…and is pushed again when the snooze ends");
T.completeTask(task); assert.equal(await R.runReminders(new Date(now.getTime() + 40 * 60_000), noClassic, fakePush), 0); ok("a completed task isn't pushed");
S.setSetting("notify_lead", "10"); const early = T.createTask({ title: "Leave for airport", due: date, due_time: at(cur + 8) }); pushed.length = 0;
assert.equal(await R.runReminders(now, noClassic, fakePush), 1); assert.equal(pushed[0].p.id, early); ok("pushes follow the 'remind me before' setting");
const failPush = async () => ({ sent: 0, failed: 1, removed: 0, errors: ["x: HTTP 503"] }); const retry = T.createTask({ title: "Retry by push", due: date, due_time: hm });
assert.equal(await R.runReminders(now, noClassic, failPush), 0); pushed.length = 0; assert.equal(await R.runReminders(now, noClassic, fakePush), 1); assert.equal(pushed[0].p.id, retry); ok("a push no device accepted is retried, not lost");
S.setSetting("quiet_start", at(cur - 1)); S.setSetting("quiet_end", at(cur + 30)); const quiet = T.createTask({ title: "Quiet one", due: date, due_time: hm });
assert.equal(await R.runReminders(now, noClassic, fakePush), 0); S.setSetting("quiet_start", null); S.setSetting("quiet_end", null); pushed.length = 0;
assert.equal(await R.runReminders(now, noClassic, fakePush), 1); assert.equal(pushed[0].p.id, quiet); ok("quiet hours hold pushes back, and they go out afterwards");
F.setFeature("reminders", false); T.createTask({ title: "Off", due: date, due_time: hm }); assert.equal(await R.runReminders(now, noClassic, fakePush), 0); F.setFeature("reminders", true); ok("nothing is pushed with Reminders switched off");
pushed.length = 0; await R.runReminders(now, noClassic, fakePush); // clear the "Off" task's reminder now that reminders are back on

// ---- morning brief, and push alongside ntfy
S.setSetting("brief_time", at(cur - 5)); S.setSetting("ntfy_topic", "t"); pushed.length = 0;
const viaNtfy: any[] = []; const ntfy = async (x: any) => { viaNtfy.push(x); return { ntfy: "ok" }; };
T.createTask({ title: "Both channels", due: date, due_time: hm });
await R.runReminders(now, ntfy, fakePush);
assert.ok(pushed.some((x) => x.p.tag === "lifeos-brief")); assert.ok(viaNtfy.some((x) => /Good morning/.test(x.title))); ok("the morning brief goes by push and by ntfy");
assert.ok(pushed.some((x) => x.p.title === "Both channels")); assert.ok(viaNtfy.some((x) => x.title === "Both channels")); ok("with both set up, a reminder goes to each, once");
pushed.length = 0; viaNtfy.length = 0; await R.runReminders(now, ntfy, fakePush); assert.equal(pushed.length + viaNtfy.length, 0); ok("neither channel repeats");
clear(); S.setSetting("ntfy_topic", null); assert.equal(await R.runReminders(now, noClassic, fakePush), 0); ok("with no devices and no other channel, nothing is attempted");

const X = await L("exporter"); const ex = JSON.stringify(X.exportAll()); assert.ok(!ex.includes(k1.privateKey) && !ex.includes("vapid_private") && !ex.includes(good.keys.auth)); ok("the export never contains the private push key or device secrets");

console.log(`\n${n} checks passed`);
