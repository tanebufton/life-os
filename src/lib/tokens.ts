import crypto from "node:crypto";
import { db } from "./db";
import { getSetting, setSetting } from "./settings";

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const AREAS = ["tasks", "habits", "journal", "money", "subscriptions", "voice"] as const;
export type Area = (typeof AREAS)[number];
export type Level = "read" | "write";
export type TokenInfo = { id: number; level: Level; areas: Area[] | null };
/** `days` = how long it stays valid (omit for never). `areas` limits it to some parts of the API (omit for all). */
export function createToken(name: string, o: { level?: Level; areas?: string[] | null; days?: number | null } = {}): string {
  const token = "lifeos_" + crypto.randomBytes(24).toString("hex");
  const level: Level = o.level === "read" ? "read" : "write", areas = o.areas?.length ? AREAS.filter((a) => o.areas!.includes(a)) : null;
  const exp = o.days && o.days > 0 ? new Date(Date.now() + o.days * 86_400_000).toISOString() : null;
  db.prepare("INSERT INTO api_tokens (name, hash, prefix, level, areas, expires_at) VALUES (?,?,?,?,?,?)").run(name.trim() || "token", hash(token), token.slice(0, 12), level, areas ? JSON.stringify(areas) : null, exp);
  return token; // shown once, only the hash is stored
}
export type TokenRow = { id: number; name: string; prefix: string; created_at: string; last_used_at: string | null; level: Level; areas: string | null; expires_at: string | null };
export const listTokens = () => db.prepare("SELECT id, name, prefix, created_at, last_used_at, level, areas, expires_at FROM api_tokens ORDER BY id DESC").all() as TokenRow[];
export const revokeToken = (id: number) => db.prepare("DELETE FROM api_tokens WHERE id=?").run(id).changes > 0;
/** The token behind an `Authorization: Bearer` header, or null if missing, unknown or expired. */
export function verifyToken(header: string | null | undefined): TokenInfo | null {
  const m = header?.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const r = db.prepare("SELECT id, level, areas, expires_at FROM api_tokens WHERE hash=?").get(hash(m[1])) as { id: number; level: Level; areas: string | null; expires_at: string | null } | undefined;
  if (!r || (r.expires_at && Date.parse(r.expires_at) <= Date.now())) return null;
  db.prepare("UPDATE api_tokens SET last_used_at=datetime('now') WHERE id=?").run(r.id);
  let areas: Area[] | null = null; try { areas = r.areas ? (JSON.parse(r.areas) as Area[]) : null; } catch { areas = []; } // unreadable restriction fails closed
  return { id: r.id, level: r.level === "read" ? "read" : "write", areas };
}
export const verifyBearer = (header: string | null | undefined) => !!verifyToken(header);
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
