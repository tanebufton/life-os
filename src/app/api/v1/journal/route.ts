import { body, err, guard, json } from "@/lib/api";
import { getEntry, saveEntry } from "@/lib/journal";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const g = guard(req, "journal"); if (g) return g;
  const date = new URL(req.url).searchParams.get("date") ?? today();
  return json({ date, entry: getEntry(date) ?? null });
}
export async function PUT(req: Request) {
  const g = guard(req, "journal"); if (g) return g;
  const b = await body(req), date = typeof b.date === "string" ? b.date : today();
  try { saveEntry(date, { mood: b.mood, body: typeof b.body === "string" ? (b.append && getEntry(date)?.body ? getEntry(date)!.body + "\n\n" + b.body : b.body) : undefined }); return json({ date, entry: getEntry(date) }); }
  catch (e) { return err((e as Error).message); }
}
