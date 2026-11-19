import { body, err, guard, json } from "@/lib/api";
import { listMemos, saveMemo, type MemoAs } from "@/lib/voice";

export const dynamic = "force-dynamic";
// Called from the Chrome extension (CORS: extensions with host permission bypass it) and from scripts/shortcuts.
export function GET(req: Request) { const g = guard(req, "voice"); if (g) return g; return json({ memos: listMemos(Number(new URL(req.url).searchParams.get("limit")) || 20) }); }
export async function POST(req: Request) {
  const g = guard(req, "voice"); if (g) return g;
  const b = (await body(req)) as { text?: string; as?: string; source?: string } | null;
  if (!b || typeof b.text !== "string") return err("Send JSON like {\"text\":\"call mum tomorrow at 5\",\"as\":\"task\"}", 400);
  const as = (["memo", "task", "note"].includes(b.as ?? "") ? b.as : "memo") as MemoAs;
  try { const m = saveMemo(b.text, as, (b.source ?? "api").slice(0, 20)); return json({ id: m.id, text: m.text, task_id: m.task_id, note_id: m.note_id }, 201); } catch (e) { return err((e as Error).message, 400); }
}
