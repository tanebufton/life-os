const $ = (id) => document.getElementById(id), t = $("t"), mic = $("mic"), hint = $("hint"), msg = $("msg");
const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null, base = "", on = false;
const ERR = { "not-allowed": "Microphone blocked. Click the camera/mic icon in the address bar area, allow it, then press the button.", "service-not-allowed": "Microphone blocked by the browser.", "no-speech": "Didn't hear anything. Press the button and try again.", "audio-capture": "No microphone found.", network: "Speech recognition needs an internet connection." };
const say = (s, c = "") => { msg.textContent = s; msg.className = c; };
function start() {
  if (!SR) { hint.textContent = "This browser has no speech recognition. You can still type."; mic.disabled = true; return; }
  rec = new SR(); rec.lang = navigator.language || "en-NZ"; rec.continuous = true; rec.interimResults = true; base = t.value ? t.value.trimEnd() + " " : "";
  rec.onresult = (e) => { let f = "", i = ""; for (let k = 0; k < e.results.length; k++) (e.results[k].isFinal ? (f += e.results[k][0].transcript) : (i += e.results[k][0].transcript)); t.value = base + f + i; };
  rec.onerror = (e) => { say(ERR[e.error] || "Speech error: " + e.error, "err"); setOn(false); }; rec.onend = () => setOn(false);
  say(""); setOn(true); try { rec.start(); } catch { setOn(false); }
}
function setOn(v) { on = v; mic.classList.toggle("on", v); mic.setAttribute("aria-label", v ? "Stop recording" : "Start recording"); hint.textContent = v ? "Listening… press to stop" : "Press the button to speak"; }
mic.onclick = () => (on ? rec.stop() : start());
async function save(as) {
  if (on) rec.stop(); const text = t.value.trim(); if (!text) return say("Nothing to save yet.", "err");
  document.querySelectorAll(".b").forEach((b) => (b.disabled = true)); say("Sending…");
  try { await send(text, as); say(as === "task" ? "Added as a task ✓" : as === "note" ? "Saved as a note ✓" : "Memo saved ✓", "ok"); t.value = ""; setTimeout(() => window.close(), 900); }
  catch (e) { say(e.message, "err"); document.querySelectorAll(".b").forEach((b) => (b.disabled = false)); }
}
$("task").onclick = () => save("task"); $("note").onclick = () => save("note"); $("memo").onclick = () => save("memo");
t.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") save("task"); });
setOn(false); start(); t.focus();
