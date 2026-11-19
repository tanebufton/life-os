import { NextResponse } from "next/server";
import { isOn, type FeatureKey } from "./features";
import { setActor } from "./activity";
import { clientIp, authBlocked, authFailed, hit, RATE } from "./ratelimit";
import { verifyToken, type Area } from "./tokens";
import { describeRepeat, parseTags, type TaskRow } from "./tasks";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
export const err = (message: string, status = 400) => json({ error: message }, status);
const limited = (retryAfter: number) => NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429, headers: { "retry-after": String(retryAfter), "cache-control": "no-store" } });
/**
 * Gatekeeper for /api/v1: throttles bad credentials per address, checks the token (valid, unexpired), that it may use this part of the API
 * and this kind of request (read-only tokens can't write), applies a per-token rate limit, and only then reveals whether a feature is switched off.
 */
export function guard(req: Request, feature: FeatureKey = "api"): NextResponse | null {
  if (!isOn("api")) return err("The REST API is turned off in LifeOS settings.", 404);
  const ip = clientIp(req), b = authBlocked(ip); if (b.blocked) return limited(b.retryAfter);
  if (Number(req.headers.get("content-length") ?? 0) > 1_000_000) return err("Request too large.", 413);
  const t = verifyToken(req.headers.get("authorization"));
  if (!t) { authFailed(ip); return err("Missing or invalid API token. Send `Authorization: Bearer <token>`.", 401); }
  setActor(`api:${t.name}`.slice(0, 40)); // changes made with this token are recorded as coming from it
  const rl = hit(`tok:${t.id}`, RATE.perTokenPerMin, 60_000); if (!rl.ok) return limited(rl.retryAfter);
  if (req.method !== "GET" && req.method !== "HEAD" && t.level === "read") return err("This token is read-only.", 403);
  const area = (feature === "api" ? "tasks" : feature) as Area;
  if (t.areas && !t.areas.includes(area)) return err(`This token isn't allowed to use ${area}.`, 403);
  if (feature !== "api" && !isOn(feature)) return err(`The ${feature} feature is turned off in LifeOS settings.`, 404);
  return null;
}
export const taskJson = (t: TaskRow) => ({
  id: t.id, title: t.title, notes: t.notes, status: t.status, status_name: t.status_name, status_kind: t.status_kind, done: !!t.done_at, done_at: t.done_at, project: t.project_name, due: t.due, time: t.due_time, estimate_minutes: t.estimate,
  priority: t.priority, tags: t.tags, repeat: t.repeat ? describeRepeat(t.repeat) : null, parent_id: t.parent_id, subtasks: t.sub_total ? { done: t.sub_done, total: t.sub_total } : null, source: t.source,
});
export async function body(req: Request): Promise<Record<string, any>> { try { const b = await req.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; } }

/** Accepts tags as "a b" / "a,b" or ["a","b"]; rejects anything else with a clear message. */
export function cleanTags<T extends Record<string, any>>(b: T): T {
  if (b.tags === undefined) return b;
  if (typeof b.tags === "string") return { ...b, tags: parseTags(b.tags) };
  if (Array.isArray(b.tags) && b.tags.every((x: unknown) => typeof x === "string")) return b;
  throw new Error("`tags` must be a string like \"a b\" or an array of strings");
}
