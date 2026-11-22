// Web Push: notifications that reach a browser or installed app even when no LifeOS tab is open.
// The keys that identify this server to the browsers' push services (VAPID) are made on first use and kept in settings; nothing to configure.
// Each device that turns push on stores one subscription. The worker sends to every device; a device the push service says is gone is removed.
import webpush from "web-push";
import { db } from "./db";
import { assertPublicUrl } from "./netsafe";
import { getSetting, setSetting } from "./settings";

export type PushPayload = { title: string; body?: string; url?: string; tag?: string; id?: number; snooze?: number; actions?: boolean; priority?: number };
export type PushDevice = { id: number; endpoint: string; label: string; created_at: string; last_ok: string | null; last_error: string | null; fails: number };
export type SubscriptionInput = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
type Row = PushDevice & { p256dh: string; auth: string };
export type Sender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, body: string, opts: webpush.RequestOptions) => Promise<{ statusCode: number }>;

const MAX_DEVICES = 20;

export function vapidKeys(): { publicKey: string; privateKey: string } {
  const pub = getSetting("vapid_public"), priv = getSetting("vapid_private");
  if (pub && priv) return { publicKey: pub, privateKey: priv };
  const k = webpush.generateVAPIDKeys();
  // Two processes (web and worker) could both get here on a brand-new database: only the first write wins, and both use what's stored.
  db.transaction(() => { if (!getSetting("vapid_public")) { setSetting("vapid_public", k.publicKey); setSetting("vapid_private", k.privateKey); } }).immediate();
  return { publicKey: getSetting("vapid_public")!, privateKey: getSetting("vapid_private")! };
}
export const vapidPublicKey = () => vapidKeys().publicKey;
// Push services ask for a contact. The app's own address is enough; it is only seen by Google, Mozilla or Apple if something goes wrong.
const subject = () => { const b = (process.env.LIFEOS_BASE_URL ?? "").trim(); return /^https:\/\//i.test(b) ? b.replace(/\/$/, "") : "mailto:lifeos@localhost"; };

/** Push services all use https on their own hosts. Anything else is refused, so a crafted "subscription" can't make the server call a local address. */
function validEndpoint(u: string): boolean {
  try { return u.length <= 1000 && assertPublicUrl(u).protocol === "https:"; } catch { return false; }
}
const b64url = (s: unknown, min: number, max: number) => typeof s === "string" && /^[A-Za-z0-9_-]+=*$/.test(s) && s.length >= min && s.length <= max;

/** Save (or refresh) this device's subscription. `oldEndpoint` is the one it replaces when the browser rotated it. */
export function saveSubscription(sub: SubscriptionInput, label = "", oldEndpoint?: string): number {
  const endpoint = String(sub?.endpoint ?? ""), p256dh = sub?.keys?.p256dh, auth = sub?.keys?.auth;
  if (!validEndpoint(endpoint)) throw new Error("That isn't a push subscription this server can use.");
  if (!b64url(p256dh, 80, 100) || !b64url(auth, 16, 30)) throw new Error("The subscription's keys are missing or malformed.");
  const clean = String(label).replace(/\s+/g, " ").trim().slice(0, 60);
  return db.transaction(() => {
    let carried = ""; // a rotated subscription keeps the old one's name
    if (oldEndpoint && oldEndpoint !== endpoint) { carried = (db.prepare("SELECT label FROM push_subscriptions WHERE endpoint=?").get(oldEndpoint) as { label: string } | undefined)?.label ?? ""; db.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").run(oldEndpoint); }
    const known = db.prepare("SELECT id FROM push_subscriptions WHERE endpoint=?").get(endpoint) as { id: number } | undefined;
    if (known) { db.prepare("UPDATE push_subscriptions SET p256dh=?, auth=?, label=COALESCE(NULLIF(?, ''), label), fails=0, last_error=NULL WHERE id=?").run(p256dh, auth, clean || carried, known.id); return known.id; }
    const n = (db.prepare("SELECT count(*) AS n FROM push_subscriptions").get() as { n: number }).n;
    if (n >= MAX_DEVICES) throw new Error(`Push is already on for ${MAX_DEVICES} devices. Remove one in Settings first.`);
    return Number(db.prepare("INSERT INTO push_subscriptions (endpoint, p256dh, auth, label) VALUES (?,?,?,?)").run(endpoint, p256dh, auth, clean || carried || "This device").lastInsertRowid);
  })();
}
export const listDevices = (): PushDevice[] => db.prepare("SELECT id, endpoint, label, created_at, last_ok, last_error, fails FROM push_subscriptions ORDER BY created_at, id").all() as PushDevice[];
export const removeDevice = (id: number) => db.prepare("DELETE FROM push_subscriptions WHERE id=?").run(id).changes > 0;
export const removeEndpoint = (endpoint: string) => db.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").run(endpoint).changes > 0;
export const isKnownEndpoint = (endpoint: string) => !!db.prepare("SELECT 1 FROM push_subscriptions WHERE endpoint=?").get(endpoint);
export const pushConfigured = () => !!db.prepare("SELECT 1 FROM push_subscriptions LIMIT 1").get();

const realSender: Sender = (sub, body, opts) => webpush.sendNotification(sub, body, opts);
/** Keep the message well under the ~4 KB push services accept. */
function encode(p: PushPayload): string {
  const clip = (s: string | undefined, n: number) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s);
  return JSON.stringify({ ...p, title: clip(p.title, 200), body: clip(p.body, 800) });
}
/**
 * Send to every device (or the given ones). Returns how many accepted it.
 * 404/410 mean the browser threw the subscription away (permission revoked, app uninstalled): those are deleted at once.
 * Any other failure (the push service is down, a timeout) only counts against the device and shows in Settings, so an outage never removes it.
 */
export async function sendPush(p: PushPayload, opts: { ids?: number[]; ttl?: number; send?: Sender } = {}): Promise<{ sent: number; failed: number; removed: number; errors: string[] }> {
  const { publicKey, privateKey } = vapidKeys(), send = opts.send ?? realSender, body = encode(p);
  const rows = (db.prepare("SELECT * FROM push_subscriptions").all() as Row[]).filter((r) => !opts.ids || opts.ids.includes(r.id));
  const out = { sent: 0, failed: 0, removed: 0, errors: [] as string[] };
  await Promise.all(rows.map(async (r) => {
    try {
      const res = await send({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, body, { vapidDetails: { subject: subject(), publicKey, privateKey }, TTL: opts.ttl ?? 3600, urgency: (p.priority ?? 3) >= 4 ? "high" : "normal", timeout: 10_000, ...(p.tag ? { topic: p.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined } : {}) });
      if (res.statusCode >= 200 && res.statusCode < 300) { out.sent++; db.prepare("UPDATE push_subscriptions SET last_ok=datetime('now'), fails=0, last_error=NULL WHERE id=?").run(r.id); return; }
      throw Object.assign(new Error(`HTTP ${res.statusCode}`), { statusCode: res.statusCode });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode, msg = code ? `HTTP ${code}` : (e as Error).message.slice(0, 200);
      out.failed++; out.errors.push(`${r.label}: ${msg}`);
      if (code === 404 || code === 410) { removeDevice(r.id); out.removed++; }
      else db.prepare("UPDATE push_subscriptions SET fails=fails+1, last_error=? WHERE id=?").run(msg, r.id);
    }
  }));
  return out;
}
