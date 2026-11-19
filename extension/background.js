// The recorder is the toolbar popup. The keyboard shortcut opens that same popup.
// (If the browser can't open it from a shortcut, fall back to a small window.)
chrome.commands.onCommand.addListener(async (c) => {
  if (c !== "record") return;
  try { await chrome.action.openPopup(); }
  catch { await chrome.windows.create({ url: "recorder.html", type: "popup", width: 400, height: 470 }); }
});
chrome.runtime.onInstalled.addListener(async ({ reason }) => { if (reason === "install") chrome.runtime.openOptionsPage(); });
