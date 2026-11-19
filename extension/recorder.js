const $ = (id) => document.getElementById(id), t = $("t"), mic = $("mic"), hint = $("hint"), msg = $("msg");
const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null, base = "", on = false, downAt = 0, released = false;
const ERR = { "not-allowed": "Microphone blocked. Click the camera/mic icon in the address bar area, allow it, then try again.", "service-not-allowed": "Microphone blocked by the browser.", "no-speech": "Didn't hear anything. Hold the button while you speak.", "audio-capture": "No microphone found.", network: "Speech recognition needs an internet connection." };
const say = (s, c = "") => { msg.textContent = s; msg.className = c; };
function setOn(v) { on = v; mic.classList.toggle("on", v); mic.setAttribute("aria-pressed", v); hint.textContent = v ? "Listening… let go to add it as a task" : "Hold the button (or the Space bar) and speak. Let go to add it as a task."; }
function start() {
  if (on) return; if (!SR) { hint.textContent = "This browser has no speech recognition. You can still type below."; mic.disabled = true; return; }
  downAt = Date.now(); released = false; rec = new SR(); rec.lang = navigator.language || "en-NZ"; rec.continuous = true; rec.interimResults = true; base = t.value ? t.value.trimEnd() + " " : "";
  rec.onresult = (e) => { let f = "", i = ""; for (let k = 0; k < e.results.length; k++) (e.results[k].isFinal ? (f += e.results[k][0].transcript) : (i += e.results[k][0].transcript)); t.value = base + f + i; };
  rec.onerror = (e) => { say(ERR[e.error] || "Speech error: " + e.error, "err"); setOn(false); }; rec.onend = () => { setOn(false); if (released) { released = false; afterRelease(); } };
  say(""); setOn(true); try { rec.start(); } catch { setOn(false); }
}
function release() { if (!on || !rec) return; released = true; rec.stop(); }
function afterRelease() { if (Date.now() - downAt < 350) return say("Hold the button while you speak, then let go.", "err"); if (!t.value.trim()) return say("Didn't catch anything. Hold the button while you speak.", "err"); save("task"); }
mic.addEventListener("pointerdown", (e) => { e.preventDefault(); mic.setPointerCapture(e.pointerId); start(); }); mic.addEventListener("pointerup", release); mic.addEventListener("pointercancel", release); mic.addEventListener("lostpointercapture", release); mic.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => { if (e.code === "Space" && !e.repeat && document.activeElement !== t && !(e.target instanceof HTMLButtonElement && e.target !== mic)) { e.preventDefault(); start(); } });
document.addEventListener("keyup", (e) => { if (e.code === "Space") { e.preventDefault(); release(); } });
async function save(as) {
  if (on) release(); const text = t.value.trim(); if (!text) return say("Nothing to save yet.", "err");
  document.querySelectorAll(".b").forEach((b) => (b.disabled = true)); say("Sending…");
  try { await send(text, as); say(as === "task" ? "Added as a task ✓" : as === "note" ? "Saved as a note ✓" : "Memo saved ✓", "ok"); t.value = ""; setTimeout(() => window.close(), 900); }
  catch (e) { say(e.message, "err"); document.querySelectorAll(".b").forEach((b) => (b.disabled = false)); }
}
$("task").onclick = () => save("task"); $("note").onclick = () => save("note"); $("memo").onclick = () => save("memo");
t.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") save("task"); });
setOn(false); if (!SR) { hint.textContent = "This browser has no speech recognition. You can still type below."; mic.disabled = true; } t.focus();

// A toolbar popup can't show Chrome's microphone prompt (it closes first), so the one-time permission is granted on the options page.
const perm = $("perm");
(async () => { try { const st = await navigator.permissions.query({ name: "microphone" }); const show = () => { perm.hidden = st.state === "granted"; }; show(); st.onchange = show; } catch { /* unsupported: the error message will say */ } })();
$("allow").onclick = () => { chrome.tabs.create({ url: chrome.runtime.getURL("options.html#mic") }); window.close(); };
