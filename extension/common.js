const get = () => chrome.storage.local.get({ base: "", token: "", cfId: "", cfSecret: "" });
async function send(text, as) {
  const { base, token, cfId, cfSecret } = await get();
  if (!base || !token) throw new Error("Not set up yet. Open the extension options and add your LifeOS address and API token.");
  const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  if (cfId && cfSecret) { headers["CF-Access-Client-Id"] = cfId; headers["CF-Access-Client-Secret"] = cfSecret; }
  let r; try { r = await fetch(`${base.replace(/\/$/, "")}/api/v1/voice`, { method: "POST", headers, body: JSON.stringify({ text, as, source: "chrome" }) }); }
  catch { throw new Error("Couldn't reach LifeOS. Check the address and that you're online (or on Tailscale)."); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error("LifeOS rejected the token. Create a new one in Settings → API.");
  if (r.status === 404) throw new Error(j.error || "The voice feature is switched off in LifeOS settings.");
  if (!r.ok) throw new Error(j.error || `LifeOS answered ${r.status}`);
  return j;
}
