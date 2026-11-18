import { body, cleanTags, err, guard, json, taskJson } from "@/lib/api";
import { deleteTask, getTask, updateTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: Request, { params }: Ctx) {
  const g = guard(req); if (g) return g;
  const t = getTask(Number((await params).id));
  return t ? json({ task: taskJson(t) }) : err("Not found", 404);
}
export async function PATCH(req: Request, { params }: Ctx) {
  const g = guard(req); if (g) return g;
  const id = Number((await params).id), b = await body(req);
  try {
    const { time, estimate_minutes, ...rest } = cleanTags(b);
    if (!updateTask(id, { ...rest, ...(time !== undefined ? { due_time: time } : {}), ...(estimate_minutes !== undefined ? { estimate: estimate_minutes } : {}) })) return err("Not found", 404);
    return json({ task: taskJson(getTask(id)!) });
  } catch (e) { return err((e as Error).message); }
}
export async function DELETE(req: Request, { params }: Ctx) {
  const g = guard(req); if (g) return g;
  return deleteTask(Number((await params).id)) ? json({ deleted: true, note: "Recoverable for 30 days" }) : err("Not found", 404);
}
