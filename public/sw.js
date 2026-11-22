// Service worker: installable app, an offline copy of the pages you visit, and reminder notification actions.
// It never caches API responses. Page copies stay in this browser only, can be switched off or cleared in Settings, and exclude Settings itself.
const CACHE = "lifeos-static-v1", PAGES = "lifeos-pages-v1", FLAG = "/__lifeos_offline_off";
const NEVER = /^\/(api|settings|relogin|share|_next\/data)(\/|$)/, MAX_PAGES = 80;
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/offline.html", "/icons/icon-192.png"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== PAGES).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const offlineOn = async () => !(await (await caches.open(PAGES)).match(FLAG));
async function keepPage(req, res) {
  if (!res.ok || res.type !== "basic" || !(res.headers.get("content-type") || "").includes("text/html")) return;
  const c = await caches.open(PAGES); await c.put(req.url, res.clone());
  const keys = (await c.keys()).filter((k) => !k.url.endsWith(FLAG)); for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await c.delete(k);
}
async function page(req) {
  const u = new URL(req.url), cacheable = !NEVER.test(u.pathname);
  try {
    const net = fetch(req); net.catch(() => {}); // sign-in redirects and other non-pages pass straight through
    const res = await (cacheable ? Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 6000))]) : net);
    if (cacheable) { try { if (await offlineOn()) await keepPage(req, res); } catch { /* caching is a bonus */ } }
    return res;
  } catch {
    if (cacheable && await offlineOn()) { const hit = await (await caches.open(PAGES)).match(req.url); if (hit) return hit; }
    return (await caches.match("/offline.html")) || Response.error();
  }
}
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (r.mode === "navigate") { e.respondWith(page(r)); return; }
  if (u.pathname.startsWith("/_next/static/") || u.pathname.startsWith("/icons/")) {
    e.respondWith(caches.open(CACHE).then(async (c) => { const hit = await c.match(r); const net = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit); return hit || net; }));
  }
});
// From the app: turn page copies on or off, clear them, or fetch a few key pages in the background so they're there when you go offline.
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "lifeos:offline-mode") e.waitUntil(caches.open(PAGES).then((c) => (d.on ? c.delete(FLAG) : c.put(FLAG, new Response("off")))));
  else if (d.type === "lifeos:offline-clear") e.waitUntil(caches.open(PAGES).then(async (c) => { for (const k of await c.keys()) if (!k.url.endsWith(FLAG)) await c.delete(k); }));
  else if (d.type === "lifeos:offline-warm") e.waitUntil((async () => { if (!(await offlineOn())) return; for (const url of (d.urls || []).slice(0, 12)) { try { if (NEVER.test(new URL(url, location.origin).pathname)) continue; const req = new Request(url, { credentials: "same-origin", headers: { Accept: "text/html" } }); const res = await fetch(req); await keepPage(new Request(new URL(url, location.origin).href), res); } catch { /* offline right now */ } } })());
});

// Task reminders: the notification's buttons talk to LifeOS directly, so they work even if you don't switch to the tab.
// If that can't go through (most often: the Cloudflare Access sign-in has ended while LifeOS was closed), the task opens instead,
// through sign-in, with the same Mark done / Snooze buttons waiting at the top. Nothing is skipped silently.
const openTask = (url) => self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { const c = cs.find((x) => new URL(x.url).origin === location.origin); if (c) { if ("navigate" in c) c.navigate(url).catch(() => {}); return c.focus(); } return self.clients.openWindow(url); });
self.addEventListener("notificationclick", (e) => {
  const n = e.notification, d = n.data || {}; n.close();
  if ((e.action === "done" || e.action === "snooze") && d.id) {
    const fallback = () => openTask(`/tasks/${encodeURIComponent(d.id)}?reminder=${e.action}`);
    e.waitUntil(fetch("/api/reminders", { method: "POST", redirect: "manual", headers: { "content-type": "application/json", "x-lifeos": "1" }, credentials: "same-origin", body: JSON.stringify({ id: d.id, action: e.action, minutes: d.snooze }) })
      .then(async (res) => { const j = res.ok ? await res.json().catch(() => ({})) : {}; if (!j.ok) throw new Error("not done"); })
      .then(() => self.clients.matchAll({ type: "window" }).then((cs) => cs.forEach((c) => c.postMessage({ type: "lifeos:refresh" }))))
      .catch(fallback));
    return;
  }
  e.waitUntil(openTask(d.url || "/"));
});

// Web Push: the server sends reminders and the morning brief here, so they arrive even when no LifeOS tab is open.
// The tag matches the pop-up an open tab would show (task-<id>), so the same reminder never appears twice.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data ? e.data.text() : "" }; }
  const opts = { body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: d.tag || undefined, renotify: false, timestamp: Date.now(), data: { id: d.id, snooze: d.snooze, url: d.url || "/" } };
  if (d.actions && d.id) { opts.actions = [{ action: "done", title: "Mark done" }, { action: "snooze", title: `Snooze ${d.snooze || 15} min` }]; opts.requireInteraction = true; }
  e.waitUntil(self.registration.showNotification(d.title || "LifeOS", opts));
});
// Browsers can replace a push subscription at any time. Tell LifeOS the new one so reminders keep arriving.
const keyBytes = (b64) => { const s = atob((b64 + "===".slice((b64.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil((async () => {
    let sub = e.newSubscription;
    if (!sub) { const k = await (await fetch("/api/push", { credentials: "same-origin" })).json(); sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(k.key) }); }
    await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json", "x-lifeos": "1" }, credentials: "same-origin", body: JSON.stringify({ sub: sub.toJSON(), old: e.oldSubscription ? e.oldSubscription.endpoint : undefined }) });
  })().catch(() => {}));
});
