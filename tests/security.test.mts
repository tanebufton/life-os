import assert from "node:assert/strict"; import http from "node:http";
const calls: { url: string; body: any }[] = []; let queue: any[][] = [[{ update_id: 10, message: { chat: { id: 5 }, text: "Polled task tomorrow #tg" } }]];
const srv = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { calls.push({ url: req.url!, body: b ? JSON.parse(b) : {} }); res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, result: req.url!.endsWith("getUpdates") ? (queue.shift() ?? []) : true })); }); }).listen(0);
await new Promise((r) => srv.once("listening", r)); process.env.LIFEOS_TELEGRAM_API = `http://127.0.0.1:${(srv.address() as any).port}`; process.env.TELEGRAM_BOT_TOKEN = "TOK";
const { guard } = await import("../src/lib/api.ts"); const T = await import("../src/lib/tokens.ts"); const RL = await import("../src/lib/ratelimit.ts"); const { db } = await import("../src/lib/db.ts");
const F = await import("../src/lib/features.ts"); const TG = await import("../src/lib/telegram.ts"); const { setSetting, getSetting } = await import("../src/lib/settings.ts"); const Tasks = await import("../src/lib/tasks.ts");
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); };
const req = (method: string, tok?: string, ip = "1.1.1.1", extra: Record<string, string> = {}) => new Request("http://x/api/v1/tasks", { method, headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), "x-forwarded-for": ip, ...extra } });
const status = (r: Response | null) => (r ? r.status : 200);

// ---- limiter
RL.resetLimits(); let r = RL.hit("k", 3, 1000, 0); r = RL.hit("k", 3, 1000, 1); r = RL.hit("k", 3, 1000, 2); assert.equal(r.ok, true); r = RL.hit("k", 3, 1000, 3); assert.equal(r.ok, false); assert.ok(r.retryAfter >= 1); assert.equal(RL.hit("k", 3, 1000, 2000).ok, true); ok("limiter blocks past the limit and recovers after the window");

// ---- tokens: levels, areas, expiry
const full = T.createToken("full"), ro = T.createToken("ro", { level: "read" }), tasksOnly = T.createToken("t", { areas: ["tasks"] }), exp = T.createToken("e", { days: 30 });
assert.deepEqual(T.verifyToken(`Bearer ${full}`)!.areas, null); assert.equal(T.verifyToken(`Bearer ${ro}`)!.level, "read"); assert.deepEqual(T.verifyToken(`Bearer ${tasksOnly}`)!.areas, ["tasks"]); ok("tokens carry their level and allowed areas");
db.prepare("UPDATE api_tokens SET expires_at=? WHERE hash IS NOT NULL AND name='e'").run(new Date(Date.now() - 1000).toISOString()); assert.equal(T.verifyToken(`Bearer ${exp}`), null); ok("an expired token stops working");
db.prepare("UPDATE api_tokens SET areas='not json' WHERE name='t'").run(); assert.deepEqual(T.verifyToken(`Bearer ${tasksOnly}`)!.areas, []); ok("a corrupt area restriction fails closed (allows nothing)");
db.prepare("UPDATE api_tokens SET areas=? WHERE name='t'").run('["tasks"]');

// ---- guard
RL.resetLimits();
assert.equal(status(guard(req("GET", full))), 200); assert.equal(status(guard(req("POST", full), "money")), 200); ok("a normal token can read and write");
assert.equal(status(guard(req("GET", ro))), 200); assert.equal(status(guard(req("POST", ro))), 403); assert.equal(status(guard(req("PATCH", ro))), 403); assert.equal(status(guard(req("DELETE", ro))), 403); ok("read-only token can GET but not POST, PATCH or DELETE");
assert.equal(status(guard(req("GET", tasksOnly), "money")), 403); assert.equal(status(guard(req("GET", tasksOnly))), 200); ok("a tasks-only token is refused on money");
assert.equal(status(guard(req("GET", exp))), 401); ok("expired token gets 401");
F.setFeature("voice", false); assert.equal(status(guard(req("GET"), "voice")), 401); assert.equal(status(guard(req("GET", full), "voice")), 404); F.setFeature("voice", true); ok("a disabled feature isn't revealed to unauthenticated callers");
assert.equal(status(guard(new Request("http://x", { method: "POST", headers: { authorization: `Bearer ${full}`, "content-length": "5000000" } }))), 413); ok("oversized request body is refused");
RL.resetLimits(); let last = 200; for (let i = 0; i < 121; i++) last = status(guard(req("GET", full, "2.2.2.2"))); assert.equal(last, 429); RL.resetLimits(); ok("per-token rate limit returns 429 after 120 requests a minute");
RL.resetLimits(); for (let i = 0; i < 10; i++) assert.equal(status(guard(req("GET", "lifeos_wrong", "9.9.9.9"))), 401); assert.equal(status(guard(req("GET", "lifeos_wrong", "9.9.9.9"))), 429); assert.equal(status(guard(req("GET", full, "9.9.9.9"))), 429); assert.equal(status(guard(req("GET", "lifeos_wrong", "8.8.8.8"))), 401); ok("10 bad tokens lock out that address (even with a good token), others unaffected");
RL.resetLimits();

// ---- secret-URL routes
const ical = await import("../src/app/api/ical/[secret]/route.ts"); const iReq = (ip = "3.3.3.3") => new Request("http://x/api/ical/s.ics", { headers: { "x-forwarded-for": ip } });
let res = await ical.GET(iReq(), { params: Promise.resolve({ secret: "wrong.ics" }) }); assert.equal(res.status, 404); assert.equal(res.headers.get("referrer-policy"), "no-referrer");
res = await ical.GET(iReq(), { params: Promise.resolve({ secret: T.icalSecret() + ".ics" }) }); assert.equal(res.status, 200); assert.match(res.headers.get("content-type")!, /calendar/); ok("calendar feed: wrong secret 404, right secret 200, no-referrer");
RL.resetLimits(); for (let i = 0; i < 10; i++) await ical.GET(iReq("4.4.4.4"), { params: Promise.resolve({ secret: "x" }) }); res = await ical.GET(iReq("4.4.4.4"), { params: Promise.resolve({ secret: T.icalSecret() }) }); assert.equal(res.status, 429); ok("calendar feed: guessing is throttled"); RL.resetLimits();

const inbound = await import("../src/app/api/inbound/email/route.ts"); const mail = (h: Record<string, string>, q = "") => new Request("http://x/api/inbound/email" + q, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "5.5.5.5", ...h }, body: JSON.stringify({ subject: "Inbound test", text: "hi" }) });
assert.equal((await inbound.POST(mail({}))).status, 401); assert.ok([200, 201].includes((await inbound.POST(mail({ "x-lifeos-secret": T.inboundSecret() }))).status)); assert.equal((await inbound.POST(mail({ authorization: `Bearer ${ro}` }))).status, 401); assert.ok([200, 201].includes((await inbound.POST(mail({ authorization: `Bearer ${full}` }))).status)); /* 200 = recognised duplicate */ ok("inbound email: header secret and write token work; read-only token and no credentials don't");
RL.resetLimits();

// ---- telegram
const route = await import("../src/app/api/telegram/[secret]/route.ts"); setSetting("telegram_chat_id", "5"); setSetting("telegram_mode", "polling");
const hook = (secret: string, hdr?: string, ip = "6.6.6.6") => new Request("http://x/api/telegram/" + secret, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(hdr ? { "x-telegram-bot-api-secret-token": hdr } : {}) }, body: JSON.stringify({ message: { chat: { id: 99 }, text: "/today" } }) });
assert.equal((await route.POST(hook(TG.tgSecret(), TG.tgHookToken()), { params: Promise.resolve({ secret: TG.tgSecret() }) })).status, 404); ok("telegram webhook is closed while in polling mode");
setSetting("telegram_mode", "webhook"); const P = (s: string, h?: string, ip?: string) => route.POST(hook(s, h, ip), { params: Promise.resolve({ secret: s }) });
assert.equal((await P("wrong", TG.tgHookToken())).status, 404); assert.equal((await P(TG.tgSecret())).status, 404); assert.equal((await P(TG.tgSecret(), "wrong")).status, 404); assert.equal((await P(TG.tgSecret(), TG.tgHookToken())).status, 200); ok("telegram webhook needs BOTH the URL secret and the header secret token");
RL.resetLimits(); for (let i = 0; i < 10; i++) await P(TG.tgSecret(), "bad", "7.7.7.7"); assert.equal((await P(TG.tgSecret(), TG.tgHookToken(), "7.7.7.7")).status, 429); ok("telegram webhook: forged attempts are throttled"); RL.resetLimits();
calls.length = 0; await TG.tgUseMode("webhook", "https://life.example.com"); const sw = calls.find((c) => c.url.endsWith("setWebhook"))!; assert.equal(sw.body.secret_token, TG.tgHookToken()); assert.ok(sw.body.url.endsWith("/api/telegram/" + TG.tgSecret())); assert.equal(getSetting("telegram_mode"), "webhook"); ok("registering the webhook sends Telegram the secret token");
calls.length = 0; await TG.tgUseMode("polling"); assert.ok(calls.some((c) => c.url.endsWith("deleteWebhook"))); assert.equal(TG.tgMode(), "polling"); ok("switching to polling removes the webhook");

// ---- polling
calls.length = 0; const sent: string[] = []; const got = await TG.pollOnce(1, async (_c, t) => { sent.push(t); }); assert.equal(got, 1); assert.ok(sent[0]?.startsWith("Added #")); assert.equal(getSetting("telegram_offset"), "11");
assert.ok(Tasks.searchTasks("Polled task", 5).length === 1); ok("polling handles a message and saves the offset");
await TG.pollOnce(1, async () => {}); assert.equal(calls.filter((c) => c.url.endsWith("getUpdates")).at(-1)!.body.offset, 11); ok("the next poll asks only for newer messages");
console.log(`\n${n} checks passed`); srv.close(); process.exit(0);
