import { getSetting } from "./settings";
import { tgChat, tgConfigured, tgSend, tgToken } from "./telegram";
import { isOn } from "./features";

export type Note = { title: string; body?: string; click?: string; priority?: 1 | 2 | 3 | 4 | 5; tags?: string[] };
export const notifyConfigured = () => ({ ntfy: !!getSetting("ntfy_topic"), webhook: !!getSetting("webhook_url"), telegram: isOn("telegram") && tgConfigured() });
const base = () => (process.env.LIFEOS_BASE_URL ?? "").replace(/\/$/, "");

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  if (!/^https?:\/\//i.test(url)) throw new Error("URL must start with http(s)://");
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}
/** Sends to every configured channel. Returns "ok" or an error string per channel. */
export async function notify(n: Note): Promise<{ ntfy?: string; webhook?: string; telegram?: string }> {
  const out: { ntfy?: string; webhook?: string; telegram?: string } = {};
  if (isOn("telegram") && tgToken() && tgChat()) { try { await tgSend(tgChat(), `${n.title}${n.body ? "\n" + n.body : ""}`); out.telegram = "ok"; } catch (e) { out.telegram = (e as Error).message; } }
  // A relative link is useless on a phone, so only send one when we know the public base URL (set LIFEOS_BASE_URL).
  const click = n.click ? (n.click.startsWith("http") ? n.click : base() ? base() + n.click : undefined) : undefined;
  const topic = getSetting("ntfy_topic");
  if (topic) {
    try {
      const token = getSetting("ntfy_token");
      await post((getSetting("ntfy_url") || "https://ntfy.sh").replace(/\/$/, ""), { topic, title: n.title, message: n.body || n.title, priority: n.priority ?? 3, tags: n.tags, click: click || undefined }, token ? { authorization: `Bearer ${token}` } : {});
      out.ntfy = "ok";
    } catch (e) { out.ntfy = (e as Error).message; }
  }
  const hook = getSetting("webhook_url");
  if (hook) {
    try { await post(hook, { source: "lifeos", title: n.title, body: n.body ?? "", url: click ?? null, priority: n.priority ?? 3, tags: n.tags ?? [], text: `${n.title}${n.body ? "\n" + n.body : ""}` }); out.webhook = "ok"; }
    catch (e) { out.webhook = (e as Error).message; }
  }
  return out;
}
