const $ = (id) => document.getElementById(id), m = $("m");
const say = (s, c) => { m.textContent = s; m.className = c || ""; };
get().then((v) => { for (const k of ["base", "token", "cfId", "cfSecret"]) $(k).value = v[k]; });
$("save").onclick = async () => {
  const v = { base: $("base").value.trim().replace(/\/$/, ""), token: $("token").value.trim(), cfId: $("cfId").value.trim(), cfSecret: $("cfSecret").value.trim() };
  if (!/^https?:\/\//.test(v.base)) return say("The address must start with https:// (or http://)", "err");
  let origin; try { origin = new URL(v.base).origin + "/*"; } catch { return say("That doesn't look like a web address.", "err"); }
  // Asked at save time so the extension only ever gets access to your own LifeOS address.
  const granted = await chrome.permissions.request({ origins: [origin] }); if (!granted) return say("Permission to reach that address was declined.", "err");
  await chrome.storage.local.set(v); say("Testing…");
  try { const h = { authorization: "Bearer " + v.token }; if (v.cfId && v.cfSecret) { h["CF-Access-Client-Id"] = v.cfId; h["CF-Access-Client-Secret"] = v.cfSecret; }
    const r = await fetch(v.base + "/api/v1/voice?limit=1", { headers: h }); if (r.status === 401) return say("Saved, but LifeOS rejected the token.", "err"); if (r.status === 404) return say("Saved, but the Voice memos feature is off in LifeOS (Settings → Features).", "err"); if (!r.ok) return say("Saved, but LifeOS answered " + r.status, "err"); say("Connected ✓ Click the toolbar icon (or press Alt+Shift+V) to record.", "ok"); }
  catch { say("Saved, but I couldn't reach that address.", "err"); }
};
