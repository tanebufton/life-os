import { body, cleanTags, err, guard, json, taskJson } from "@/lib/api";
import { db } from "@/lib/db";
import { createTask, getTask, parseQuickAdd, queryTasks, searchTasks } from "@/lib/tasks";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const g = guard(req); if (g) return g;
  const u = new URL(req.url).searchParams;
  const proj = u.get("project") ? (db.prepare("SELECT id FROM projects WHERE lower(name)=lower(?)").get(u.get("project")) as { id: number } | undefined) : undefined;
  if (u.get("project") && !proj) return json({ tasks: [] });
  const state = (["open", "done", "all"].includes(u.get("state") ?? "") ? u.get("state") : "open") as "open" | "done" | "all";
  const rows = u.get("q") ? searchTasks(u.get("q")!, Number(u.get("limit")) || 50)
    : queryTasks({ project: proj?.id, tag: u.get("tag") ?? undefined, state, dueBy: u.get("due_by") === "today" ? today() : u.get("due_by") ?? undefined, limit: Math.min(Number(u.get("limit")) || 100, 500) });
  return json({ tasks: rows.map(taskJson) });
}
export async function POST(req: Request) {
  const g = guard(req); if (g) return g;
  const b = await body(req);
  try {
    const fields = typeof b.text === "string" ? parseQuickAdd(b.text) : cleanTags({ ...b, title: String(b.title ?? ""), ...(b.time !== undefined ? { due_time: b.time } : {}), ...(b.estimate_minutes !== undefined ? { estimate: b.estimate_minutes } : {}) });
    if (!fields.title?.trim()) return err("`title` (or `text`) is required");
    const id = createTask({ ...fields, source: "api" });
    return json({ task: taskJson(getTask(id)!) }, 201);
  } catch (e) { return err((e as Error).message); }
}
