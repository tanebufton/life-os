import { body, err, guard, json } from "@/lib/api";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { projectByName } from "@/lib/tasks";
import { listMemos, saveMemo, type MemoAs } from "@/lib/voice";

export const dynamic = "force-dynamic";
// Called from the Chrome extension (CORS: extensions with host permission bypass it) and from scripts/shortcuts.
export function GET(req: Request) { const g = guard(req, "voice"); if (g) return g; return json({ memos: listMemos(Number(new URL(req.url).searchParams.get("limit")) || 20), projects: db.prepare("SELECT id, name, icon FROM projects WHERE archived=0 ORDER BY name").all(), default_project: Number(getSetting("voice_project")) || null }); }
export async function POST(req: Request) {
  const g = guard(req, "voice"); if (g) return g;
  const b = (await body(req)) as { text?: string; as?: string; source?: string; project?: string | number } | null;
  if (!b || typeof b.text !== "string") return err("Send JSON like {\"text\":\"call mum tomorrow at 5\",\"as\":\"task\"}", 400);
  const as = (["memo", "task", "note"].includes(b.as ?? "") ? b.as : "memo") as MemoAs;
  const asked = b.project !== undefined && b.project !== "" ? (typeof b.project === "number" ? b.project : projectByName(String(b.project))) : null;
  const pid = (asked && db.prepare("SELECT 1 FROM projects WHERE id=? AND archived=0").get(asked) ? asked : null) ?? (Number(getSetting("voice_project")) || null);
  try { const m = saveMemo(b.text, as, (b.source ?? "api").slice(0, 20), pid); return json({ id: m.id, text: m.text, task_id: m.task_id, note_id: m.note_id }, 201); } catch (e) { return err((e as Error).message, 400); }
}
