importScripts("common.js");

const flash = async (text, color, title) => { chrome.action.setBadgeBackgroundColor({ color }); chrome.action.setBadgeText({ text }); if (title) chrome.action.setTitle({ title }); setTimeout(refreshBadge, 2500); };
/** Number of tasks due today or overdue, shown on the toolbar icon. */
async function refreshBadge() {
  const c = await get(); chrome.action.setTitle({ title: "LifeOS" });
  if (!c.base || !c.token || !c.badge) { chrome.action.setBadgeText({ text: "" }); return; }
  try { const { tasks } = await api("/api/v1/tasks?due_by=today&limit=200"); chrome.action.setBadgeBackgroundColor({ color: tasks.some((t) => t.due && t.due < new Date().toISOString().slice(0, 10)) ? "#d44c47" : "#1877f2" }); chrome.action.setBadgeText({ text: tasks.length ? String(Math.min(tasks.length, 99)) : "" }); }
  catch { /* leave it as it was */ }
}
async function addAndTell(fields) {
  try { await addTask(fields); flash("✓", "#1f845a", `Added “${fields.title}” to LifeOS`); }
  catch (e) { if (e.offline) { await queueTask(fields); flash("…", "#b4720c", "No connection. Saved to send later."); } else flash("!", "#d44c47", e.message); }
}
async function pageFields(tab, selection) {
  let sel = selection || "", desc = "";
  if (!sel && tab?.id) { try { const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({ sel: String(getSelection() || "").trim().slice(0, 4000), desc: (document.querySelector('meta[property="og:description"],meta[name=description]') || {}).content || "" }) }); sel = result.sel; desc = result.desc; } catch { /* a page the browser keeps private */ } }
  return clipFields({ title: tab?.title, url: tab?.url || "", selection: sel, desc });
}

// ---- right-click menus
function menus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "page", title: "Add this page to LifeOS", contexts: ["page"] });
    chrome.contextMenus.create({ id: "selection", title: "Add selection to LifeOS", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "link", title: "Add link to LifeOS", contexts: ["link"] });
  });
}
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "link") return addAndTell(await clipFields({ title: info.selectionText || info.linkUrl, url: info.linkUrl }));
  const f = await pageFields(tab, info.menuItemId === "selection" ? info.selectionText : "");
  if (info.menuItemId === "selection" && info.selectionText) f.title = clip(info.selectionText.replace(/\s+/g, " ").trim(), 120);
  addAndTell(f);
});

// ---- keyboard: add the current page without opening anything, or open the popup on the voice tab
chrome.commands.onCommand.addListener(async (c) => {
  if (c === "add-page") { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return addAndTell(await pageFields(tab)); }
  if (c === "record") { await chrome.storage.local.set({ tab: "voice" }); try { await chrome.action.openPopup(); } catch { await chrome.windows.create({ url: "popup.html", type: "popup", width: 420, height: 520 }); } }
});

// ---- address bar: type "lf" then Tab. Type a task to add it, or search your tasks.
chrome.omnibox.setDefaultSuggestion({ description: "Add task: <match>%s</match>" });
let searchTimer;
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  clearTimeout(searchTimer); const q = text.trim(); if (q.length < 2) return;
  searchTimer = setTimeout(async () => { try { const { tasks } = await api(`/api/v1/tasks?q=${encodeURIComponent(q)}&limit=6`); suggest(tasks.map((t) => ({ content: `open:${t.id}`, description: `Open: ${t.title.replace(/[<>&]/g, " ")}${t.due ? ` <dim>(${t.due})</dim>` : ""}` }))); } catch { /* no suggestions */ } }, 250);
});
chrome.omnibox.onInputEntered.addListener(async (text) => {
  const m = /^open:(\d+)$/.exec(text); const { base } = await get();
  if (m && base) return void chrome.tabs.create({ url: `${clean(base)}/tasks/${m[1]}` });
  if (text.trim()) { try { await addTask({ text: text.trim(), ...(await get()).project ? { project: (await get()).project } : {} }); flash("✓", "#1f845a", "Added to LifeOS"); } catch (e) { if (e.offline) { await queueTask({ text: text.trim() }); flash("…", "#b4720c", "Saved to send later"); } else flash("!", "#d44c47", e.message); } }
});

// ---- upkeep
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "badge") refreshBadge(); if (a.name === "queue") flushQueue().then((n) => n && refreshBadge()); });
function setup() { menus(); chrome.alarms.create("badge", { periodInMinutes: 5 }); chrome.alarms.create("queue", { periodInMinutes: 1 }); refreshBadge(); }
chrome.runtime.onInstalled.addListener(({ reason }) => { setup(); if (reason === "install") chrome.runtime.openOptionsPage(); });
chrome.runtime.onStartup.addListener(setup);
chrome.storage.onChanged.addListener((ch) => { if (ch.token || ch.base || ch.badge) refreshBadge(); });

// ---- one-click connect: options registers a small script for your LifeOS address only; it hears the key from the Connect page and gives it to us
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === "connect-start") { startConnect(msg.base).then(() => reply({ ok: true }), (e) => reply({ ok: false, error: e.message })); return true; }
  if (msg?.type === "lifeos-connect") { finishConnect(msg, sender).then(reply); return true; }
  if (msg?.type === "refresh-badge") refreshBadge();
});
async function startConnect(base) {
  const origin = new URL(clean(base)).origin; await chrome.storage.session.set({ pending: origin });
  try { await chrome.scripting.unregisterContentScripts({ ids: ["connect"] }); } catch { /* none yet */ }
  await chrome.scripting.registerContentScripts([{ id: "connect", matches: [origin + "/connect-extension*"], js: ["connect.js"], runAt: "document_idle", persistAcrossSessions: false }]);
}
async function finishConnect(msg, sender) {
  const { pending } = await chrome.storage.session.get("pending"); let origin; try { origin = new URL(sender.url).origin; } catch { return { ok: false }; }
  if (!pending || origin !== pending || origin !== new URL(msg.base).origin || typeof msg.token !== "string" || !msg.token.startsWith("lifeos_")) return { ok: false };
  await chrome.storage.local.set({ base: origin, token: msg.token, account: String(msg.account || "") });
  await chrome.storage.session.remove("pending"); try { await chrome.scripting.unregisterContentScripts({ ids: ["connect"] }); } catch { /* ignore */ }
  try { const v = await api("/api/v1/voice?limit=1"); if (v.projects) await chrome.storage.local.set({ projects: v.projects }); } catch { /* the project list can wait */ }
  refreshBadge(); setTimeout(() => sender.tab?.id && chrome.tabs.remove(sender.tab.id).catch(() => {}), 1500);
  return { ok: true };
}
