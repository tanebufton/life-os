import { NextResponse } from "next/server";
import { isOn, type FeatureKey } from "./features";
import { verifyBearer } from "./tokens";
import { describeRepeat, parseTags, type TaskRow } from "./tasks";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
export const err = (message: string, status = 400) => json({ error: message }, status);
/** Returns an error response if the API is off or the bearer token is missing/invalid. */
export function guard(req: Request, feature: FeatureKey = "api"): NextResponse | null {
  if (!isOn("api")) return err("The REST API is turned off in LifeOS settings.", 404);
  if (feature !== "api" && !isOn(feature)) return err(`The ${feature} feature is turned off in LifeOS settings.`, 404);
  if (!verifyBearer(req.headers.get("authorization"))) return err("Missing or invalid API token. Send `Authorization: Bearer <token>`.", 401);
  return null;
}
export const taskJson = (t: TaskRow) => ({
  id: t.id, title: t.title, notes: t.notes, status: t.status, done: !!t.done_at, done_at: t.done_at, project: t.project_name, due: t.due, time: t.due_time, estimate_minutes: t.estimate,
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
