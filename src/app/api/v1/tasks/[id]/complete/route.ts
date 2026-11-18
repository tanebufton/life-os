import { err, guard, json, taskJson } from "@/lib/api";
import { completeTask, getTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = guard(req); if (g) return g;
  const id = Number((await params).id), r = completeTask(id);
  return r ? json({ ...r, task: taskJson(getTask(id)!) }) : err("Not found", 404);
}
