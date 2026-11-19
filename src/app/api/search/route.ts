import { NextResponse } from "next/server";
import { searchAll, type Kind } from "@/lib/search";
export const dynamic = "force-dynamic";
const KINDS = ["task", "note", "goal", "memo", "project"];
/** Same-origin search for the command palette and link picker (protected like the rest of the UI). `tasks` is kept for older callers. */
export function GET(req: Request) {
  const u = new URL(req.url), q = u.searchParams.get("q")?.trim() ?? "", kinds = (u.searchParams.get("kinds") ?? "").split(",").filter((k) => KINDS.includes(k)) as Kind[];
  if (q.length < 2) return NextResponse.json({ tasks: [], groups: [] });
  const r = searchAll(q, { limit: Number(u.searchParams.get("limit")) || 6, kinds: kinds.length ? kinds : undefined });
  const t = r.groups.find((g) => g.kind === "task")?.items ?? [];
  return NextResponse.json({ tasks: t.map((x) => ({ id: x.id, title: x.title, due: x.meta?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null, project: x.meta?.split(" · ")[0] ?? null })), groups: r.groups });
}
