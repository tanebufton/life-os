import crypto from "node:crypto";
import { db } from "./db";
import { getSetting, setSetting } from "./settings";

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export function createToken(name: string): string {
  const token = "lifeos_" + crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO api_tokens (name, hash, prefix) VALUES (?,?,?)").run(name.trim() || "token", hash(token), token.slice(0, 12));
  return token; // shown once, only the hash is stored
}
export const listTokens = () => db.prepare("SELECT id, name, prefix, created_at, last_used_at FROM api_tokens ORDER BY id DESC").all() as { id: number; name: string; prefix: string; created_at: string; last_used_at: string | null }[];
export const revokeToken = (id: number) => db.prepare("DELETE FROM api_tokens WHERE id=?").run(id).changes > 0;
export function verifyBearer(header: string | null | undefined): boolean {
  const m = header?.match(/^Bearer\s+(\S+)$/i);
  if (!m) return false;
  const r = db.prepare("SELECT id FROM api_tokens WHERE hash=?").get(hash(m[1])) as { id: number } | undefined;
  if (r) db.prepare("UPDATE api_tokens SET last_used_at=datetime('now') WHERE id=?").run(r.id);
  return !!r;
}
/** Long random path secret for the calendar feed (calendar apps can't send headers). */
export function icalSecret(regenerate = false): string {
  let s = getSetting("ical_secret");
  if (!s || regenerate) { s = crypto.randomBytes(18).toString("hex"); setSetting("ical_secret", s); }
  return s;
}
export function inboundSecret(regenerate = false): string {
  let s = getSetting("inbound_secret");
  if (!s || regenerate) { s = crypto.randomBytes(18).toString("hex"); setSetting("inbound_secret", s); }
  return s;
}
export const safeEq = (a: string, b: string) => { const A = Buffer.from(a), B = Buffer.from(b); return A.length === B.length && crypto.timingSafeEqual(A, B); };
