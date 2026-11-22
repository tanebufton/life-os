// Runs only on your own LifeOS "Connect the extension" page (registered for that address when you press Connect). Passes the key it is given to the extension, and says so.
window.addEventListener("message", (e) => {
  if (e.source !== window || e.origin !== location.origin || !e.data || e.data.lifeosExtension !== true) return;
  chrome.runtime.sendMessage({ type: "lifeos-connect", base: e.data.base, token: e.data.token, account: e.data.account }, (r) => { if (r && r.ok) window.postMessage({ lifeosExtensionAck: true }, location.origin); });
});
