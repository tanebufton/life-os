import { guard, json, taskJson } from "@/lib/api";
import { searchTasks } from "@/lib/tasks";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const g = guard(req); if (g) return g;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return json({ q, tasks: searchTasks(q, 50).map(taskJson) });
}
