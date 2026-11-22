const $ = (id) => document.getElementById(id);
const say = (el, s, c) => { el.textContent = s; el.className = c || ""; };
const state = $("state");

function paint(v) {
  $("base").value = v.base || ""; $("followup").value = v.followup || ""; $("tags").value = v.tags ?? "clip"; $("badge").checked = v.badge !== false; $("token").value = v.token || ""; $("cfId").value = v.cfId || ""; $("cfSecret").value = v.cfSecret || "";
  const sel = $("project"); sel.length = 1; for (const p of v.projects || []) { const o = document.createElement("option"); o.value = p.name; o.textContent = (p.icon ? p.icon + " " : "") + p.name; sel.appendChild(o); } sel.value = v.project || "";
  const on = !!(v.base && v.token); $("disconnect").hidden = !on; $("acct").hidden = !on; $("connect").textContent = on ? "Reconnect" : "Connect";
  if (on) { $("acct").textContent = `Connected to ${v.base}${v.account ? ` as ${v.account}` : ""}.`; if (!state.textContent || state.textContent.startsWith("Waiting")) say(state, "Connected ✓", "ok"); }
}
get().then(paint);
chrome.storage.onChanged.addListener(() => get().then(paint));

// Defaults save as you change them.
for (const id of ["project", "followup", "badge"]) $(id).onchange = () => chrome.storage.local.set({ project: $("project").value, followup: $("followup").value, badge: $("badge").checked });
$("tags").onchange = () => chrome.storage.local.set({ tags: $("tags").value.trim() });

$("connect").onclick = async () => {
  let base; try { const u = new URL($("base").value.trim()); if (!/^https?:$/.test(u.protocol)) throw 0; base = u.origin; } catch { return say(state, "Enter your LifeOS address, starting with https://", "err"); }
  // Asked now so the extension only ever gets access to your own LifeOS address.
  const granted = await chrome.permissions.request({ origins: [base + "/*"] }); if (!granted) return say(state, "Permission to reach that address was declined.", "err");
  await chrome.storage.local.set({ base });
  const r = await chrome.runtime.sendMessage({ type: "connect-start", base }); if (!r?.ok) return say(state, r?.error || "Couldn't start connecting.", "err");
  say(state, "Waiting for you to press the button in the LifeOS tab that just opened…");
  chrome.tabs.create({ url: base + "/connect-extension" });
};
$("disconnect").onclick = async () => { await chrome.storage.local.set({ token: "", account: "" }); say(state, "Disconnected. (You can also revoke the key in LifeOS → Settings → Connections.)"); };

$("savemanual").onclick = async () => {
  const m = $("manualmsg"), base = $("base").value.trim().replace(/\/$/, "");
  let origin; try { origin = new URL(base).origin; } catch { return say(m, "Enter your LifeOS address above first.", "err"); }
  if (!(await chrome.permissions.request({ origins: [origin + "/*"] }))) return say(m, "Permission to reach that address was declined.", "err");
  await chrome.storage.local.set({ base: origin, token: $("token").value.trim(), cfId: $("cfId").value.trim(), cfSecret: $("cfSecret").value.trim() }); say(m, "Testing…");
  try { const v = await api("/api/v1/voice?limit=1"); if (v.projects) await chrome.storage.local.set({ projects: v.projects }); say(m, "Connected ✓", "ok"); } catch (e) { say(m, e.message, "err"); }
};

$("allowmic").onclick = async () => {
  const mm = $("micmsg");
  try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); say(mm, "Microphone allowed ✓", "ok"); }
  catch { say(mm, "The microphone is blocked. Click the lock icon in the address bar, allow it, and try again.", "err"); }
};
if (location.hash === "#mic") $("allowmic").focus();
