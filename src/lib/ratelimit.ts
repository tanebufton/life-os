// Small in-memory sliding-window limiter. One per process, which is right for a single-user app behind one web server.
const hits = new Map<string, number[]>();
let lastSweep = 0;
function sweep(now: number) { if (now - lastSweep < 60_000 && hits.size < 5000) return; lastSweep = now; for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 3_600_000) hits.delete(k); }
const recent = (key: string, windowMs: number, now: number) => { const a = (hits.get(key) ?? []).filter((t) => now - t < windowMs); hits.set(key, a); return a; };
/** Record one event for `key` and say whether it is still within `limit` per window. */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  sweep(now); const a = recent(key, windowMs, now); a.push(now);
  return a.length > limit ? { ok: false, retryAfter: Math.max(1, Math.ceil((a[0] + windowMs - now) / 1000)) } : { ok: true, retryAfter: 0 };
}
/** Is `key` already at or over its limit? Doesn't record anything. */
export function over(key: string, limit: number, windowMs: number, now = Date.now()): { blocked: boolean; retryAfter: number } {
  const a = recent(key, windowMs, now); return a.length >= limit ? { blocked: true, retryAfter: Math.max(1, Math.ceil((a[0] + windowMs - now) / 1000)) } : { blocked: false, retryAfter: 0 };
}
export const resetLimits = () => hits.clear();
/** Best guess at the caller's address: Cloudflare's header, then the first proxy hop. Only used for throttling, never for trust. */
export function clientIp(req: Request): string {
  const h = req.headers; return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
export const RATE = {
  perTokenPerMin: Number(process.env.LIFEOS_RATE_LIMIT_PER_MIN) || 120,
  failsPerIp: 10, failWindowMs: 10 * 60_000,
};
/** Failed-credential throttle: after too many bad attempts from one address, everything from it is refused for a while. */
export const authBlocked = (ip: string) => over(`fail:${ip}`, RATE.failsPerIp, RATE.failWindowMs);
export const authFailed = (ip: string) => { hit(`fail:${ip}`, RATE.failsPerIp, RATE.failWindowMs); };
