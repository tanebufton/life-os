// Shared by the popup, the options page and the background worker.
const DEFAULTS = { base: "", token: "", account: "", cfId: "", cfSecret: "", project: "", projects: [], followup: "", tags: "clip", badge: true, queue: [], tab: "page" };
const get = () => chrome.storage.local.get(DEFAULTS);
const clean = (b) => (b || "").replace(/\/$/, "");

class NotReady extends Error {}
/** Call the LifeOS API. Sends the key, and your browser's own sign-in cookie too, so it works behind Cloudflare Access as well as over Tailscale. */
async function api(path, { method = "GET", body } = {}) {
  const { base, token, cfId, cfSecret } = await get();
  if (!base || !token) throw new NotReady("LifeOS isn't connected yet. Open the extension settings and press Connect.");
  const headers = { authorization: `Bearer ${token}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cfId && cfSecret) { headers["CF-Access-Client-Id"] = cfId; headers["CF-Access-Client-Secret"] = cfSecret; }
  let r;
  try { r = await fetch(clean(base) + path, { method, headers, credentials: "include", body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { const e = new Error("Couldn't reach LifeOS. Check your connection (or Tailscale)."); e.offline = true; throw e; }
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("json")) { const e = new Error("LifeOS wants you to sign in again. Open LifeOS in a tab, sign in, then retry."); e.signin = true; throw e; } // a Cloudflare login page came back instead of data
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { const e = new Error("LifeOS no longer accepts this extension's key. Open settings and press Connect again."); e.reconnect = true; throw e; }
  if (!r.ok) throw new Error(j.error || `LifeOS answered ${r.status}`);
  return j;
}
const addTask = (fields) => api("/api/v1/tasks", { method: "POST", body: fields });
const voice = (text, as, extra = {}) => api("/api/v1/voice", { method: "POST", body: { text, as, source: "chrome", ...extra } });
const dueFor = (when) => { if (!when) return undefined; const d = new Date(); if (when === "tomorrow") d.setDate(d.getDate() + 1); else if (when === "week") d.setDate(d.getDate() + 7); else if (/^\d{4}-\d{2}-\d{2}$/.test(when)) return when; const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
/** Fields for a task made from a web page (and maybe some text selected on it). */
async function clipFields({ title, url, selection = "", desc = "", when }) {
  const c = await get(), host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const notes = [url, selection ? "> " + selection.replace(/\n+/g, "\n> ") : desc].filter(Boolean).join("\n\n");
  const f = { title: clip((title || host || url || "Web page").replace(/\s+/g, " ").trim(), 200), notes, tags: (c.tags || "").split(/[\s,]+/).filter(Boolean) };
  const due = dueFor(when === undefined ? c.followup : when); if (due) f.due = due;
  if (c.project) f.project = c.project;
  return f;
}
/** Keep a task for later if there's no connection; sent by the background worker once there is. */
async function queueTask(fields) { const { queue } = await get(); await chrome.storage.local.set({ queue: [...queue, { fields, at: Date.now() }].slice(-100) }); }
async function flushQueue() {
  const { queue } = await get(); if (!queue.length) return 0; let sent = 0; const left = [];
  for (const q of queue) { try { await addTask(q.fields); sent++; } catch (e) { if (e.offline || e.signin || e.reconnect || e instanceof NotReady) { left.push(q); } /* a task LifeOS refuses is dropped */ } }
  await chrome.storage.local.set({ queue: left }); return sent;
}
/** Voice and typed memos from the popup's Voice tab: goes to your default project unless you've picked one. */
async function send(text, as) { const { project } = await get(); return voice(text, as, project ? { project } : {}); }
