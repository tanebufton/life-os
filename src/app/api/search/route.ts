import { NextResponse } from "next/server";
import { searchTasks } from "@/lib/tasks";
export const dynamic = "force-dynamic";
/** Same-origin search for the command palette (protected like the rest of the UI). */
export function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ tasks: [] });
  return NextResponse.json({ tasks: searchTasks(q, 8).map((t) => ({ id: t.id, title: t.title, due: t.due, project: t.project_name })) });
}
