const $ = (id) => document.getElementById(id);
const say = (el, s, c = "") => { el.textContent = s; el.className = c; };
let when = "", cfg = {}, tab = null, page = { url: "", title: "", sel: "", desc: "" };

function showTab(n) {
  document.body.dataset.tab = n;
  for (const b of document.querySelectorAll("nav [data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === n));
  for (const k of ["page", "today", "voice"]) $("p-" + k).hidden = k !== n;
  chrome.storage.local.set({ tab: n });
  if (n === "today") loadToday(); if (n === "page") $("title").focus(); if (n === "voice") window.dispatchEvent(new Event("voice-shown"));
}
for (const b of document.querySelectorAll("nav [data-tab]")) b.onclick = () => showTab(b.dataset.tab);
$("gosetup").onclick = () => { chrome.runtime.openOptionsPage(); window.close(); };

// ---- Page
for (const b of document.querySelectorAll("#when button")) b.onclick = () => { when = b.dataset.w; for (const x of document.querySelectorAll("#when button")) x.setAttribute("aria-pressed", String(x === b)); };
const setWhen = (w) => { document.querySelector(`#when button[data-w="${w}"]`)?.click(); };
async function initPage() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  page.url = tab?.url || ""; page.title = tab?.title || "";
  try { const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({ sel: String(getSelection() || "").trim().slice(0, 4000), desc: (document.querySelector('meta[property="og:description"],meta[name=description]') || {}).content || "" }) }); page.sel = result.sel; page.desc = result.desc; } catch { /* a page the browser keeps private */ }
  try { const u = new URL(page.url); $("host").textContent = u.hostname + (u.pathname.length > 1 ? u.pathname : ""); if (tab?.favIconUrl) { $("fav").src = tab.favIconUrl; $("fav").hidden = false; } } catch { $("host").textContent = page.url; }
  const f = await clipFields({ title: page.title, url: page.url, selection: page.sel, desc: page.desc, when: "" });
  $("title").value = f.title; $("notes").value = f.notes; $("tags").value = (cfg.tags || ""); setWhen(cfg.followup || "");
  const sel = $("project"); for (const p of cfg.projects || []) { const o = document.createElement("option"); o.value = p.name; o.textContent = (p.icon ? p.icon + " " : "") + p.name; sel.appendChild(o); } sel.value = cfg.project || "";
}
async function submit(as) {
  const title = $("title").value.trim(); if (!title) return say($("msg"), "Give it a title.", "err");
  const btns = [$("add"), $("addnote")]; btns.forEach((b) => (b.disabled = true)); say($("msg"), "Adding…");
  try {
    if (as === "note") { await voice(`${title}\n\n${$("notes").value}`.trim(), "note", $("project").value ? { project: $("project").value } : {}); say($("msg"), "Saved as a note ✓", "ok"); }
    else {
      const f = { title, notes: $("notes").value, tags: $("tags").value.split(/[\s,]+/).filter(Boolean), priority: $("high").checked ? 1 : 0 }; const due = dueFor(when); if (due) f.due = due; if ($("project").value) f.project = $("project").value;
      try { const r = await addTask(f); const id = r.task?.id; $("msg").innerHTML = `Added ✓ ${id ? `<a href="#" id="seeit">Open</a>` : ""}`; $("msg").className = "ok"; if (id) $("seeit").onclick = (e) => { e.preventDefault(); chrome.tabs.create({ url: `${clean(cfg.base)}/tasks/${id}` }); }; }
      catch (e) { if (e.offline) { await queueTask(f); say($("msg"), "No connection. Saved here and will be sent when you're back online ✓", "ok"); } else throw e; }
    }
    chrome.runtime.sendMessage({ type: "refresh-badge" }); setTimeout(() => window.close(), 1400);
  } catch (e) { say($("msg"), e.message, "err"); btns.forEach((b) => (b.disabled = false)); }
}
$("add").onclick = () => submit("task"); $("addnote").onclick = () => submit("note");
for (const id of ["title", "tags"]) $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") submit("task"); });
$("notes").addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit("task"); });

// ---- Today
const todayIso = () => dueFor("today");
async function loadToday() {
  say($("tmsg"), "");
  try {
    const { tasks } = await api("/api/v1/tasks?due_by=today&limit=40"), ul = $("list"); ul.textContent = "";
    if (!tasks.length) say($("tmsg"), "Nothing due. Enjoy it.", "ok");
    for (const t of tasks) {
      const li = document.createElement("li"), cb = document.createElement("input"), body = document.createElement("div"), a = document.createElement("a"), d = document.createElement("div");
      cb.type = "checkbox"; cb.setAttribute("aria-label", `Complete ${t.title}`); a.textContent = t.title; a.href = `${clean(cfg.base)}/tasks/${t.id}`; a.target = "_blank";
      d.className = "d" + (t.due && t.due < todayIso() ? " late" : ""); d.textContent = t.due && t.due < todayIso() ? `Overdue · ${t.due}` : "Today";
      cb.onchange = async () => { cb.disabled = true; try { await api(`/api/v1/tasks/${t.id}/complete`, { method: "POST" }); li.classList.add("gone"); chrome.runtime.sendMessage({ type: "refresh-badge" }); } catch (e) { cb.checked = false; cb.disabled = false; say($("tmsg"), e.message, "err"); } };
      body.append(a, d); li.append(cb, body); ul.appendChild(li);
    }
  } catch (e) { say($("tmsg"), e.message, "err"); }
}
$("quick").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter" || !$("quick").value.trim()) return; const text = $("quick").value.trim();
  try { await addTask({ text, ...(cfg.project ? { project: cfg.project } : {}) }); $("quick").value = ""; loadToday(); chrome.runtime.sendMessage({ type: "refresh-badge" }); }
  catch (err) { if (err.offline) { await queueTask({ text }); $("quick").value = ""; say($("tmsg"), "No connection. Saved here and will be sent when you're back online.", "ok"); } else say($("tmsg"), err.message, "err"); }
});
$("openapp").onclick = (e) => { e.preventDefault(); chrome.tabs.create({ url: clean(cfg.base) || chrome.runtime.getURL("options.html") }); };

(async () => {
  cfg = await get();
  if (!cfg.base || !cfg.token) { $("setup").hidden = false; }
  flushQueue();
  await initPage().catch(() => {});
  showTab(["page", "today", "voice"].includes(cfg.tab) ? cfg.tab : "page");
})();
