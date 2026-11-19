import { isOn } from "@/lib/features";
import { handleUpdate, tgSecret, type Update } from "@/lib/telegram";
import { safeEq } from "@/lib/tokens";

export const dynamic = "force-dynamic";
/** Telegram webhook. The secret in the URL is the credential; the bot only ever acts for the one chat you linked. */
export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  if (!isOn("telegram")) return new Response("off", { status: 404 });
  if (!safeEq((await params).secret, tgSecret())) return new Response("not found", { status: 404 });
  try { await handleUpdate((await req.json()) as Update); } catch (e) { console.error("telegram:", (e as Error).message); }
  return Response.json({ ok: true }); // always 200 so Telegram doesn't retry-storm
}
