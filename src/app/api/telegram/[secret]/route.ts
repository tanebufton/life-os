import { isOn } from "@/lib/features";
import { secretGate } from "@/lib/secretauth";
import { handleUpdate, tgHookToken, tgMode, tgSecret, type Update } from "@/lib/telegram";

export const dynamic = "force-dynamic";
/**
 * Telegram webhook (only used when Telegram is set to "webhook" mode; "polling" needs no public URL at all).
 * Two secrets must both match: the one in the URL, and the secret token Telegram sends in a header. The bot also only acts for the one linked chat.
 */
export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  if (!isOn("telegram") || tgMode() !== "webhook") return new Response("Not found", { status: 404 });
  const gate = secretGate(req, (await params).secret, tgSecret()); if (gate) return gate;
  const hdr = secretGate(req, req.headers.get("x-telegram-bot-api-secret-token"), tgHookToken()); if (hdr) return hdr;
  if (Number(req.headers.get("content-length") ?? 0) > 200_000) return new Response("Too large", { status: 413 });
  try { await handleUpdate((await req.json()) as Update); } catch (e) { console.error("telegram:", (e as Error).message); }
  return Response.json({ ok: true }); // always 200 so Telegram doesn't retry-storm
}
