// Opens (or focuses) the small recorder window. A window, not the toolbar popup, because Chrome closes popups
// when the microphone permission prompt appears, which would make the first recording fail.
let winId = null;
async function openRecorder() {
  if (winId !== null) { try { await chrome.windows.update(winId, { focused: true }); return; } catch { winId = null; } }
  const w = await chrome.windows.create({ url: "recorder.html", type: "popup", width: 400, height: 470 });
  winId = w.id;
}
chrome.windows.onRemoved.addListener((id) => { if (id === winId) winId = null; });
chrome.action.onClicked.addListener(openRecorder);
chrome.commands.onCommand.addListener((c) => { if (c === "record") openRecorder(); });
chrome.runtime.onInstalled.addListener(async ({ reason }) => { if (reason === "install") chrome.runtime.openOptionsPage(); });
