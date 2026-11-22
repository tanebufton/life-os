import { NextResponse } from "next/server";
import { isKnownEndpoint, saveSubscription, vapidPublicKey } from "@/lib/webpush";

export const dynamic = "force-dynamic";
const out = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

/**
 * For the service worker and the page, signed-in browser only (not part of the token API).
 * GET gives the server's public push key. POST stores a subscription again: the browser can replace one at any time
 * (`pushsubscriptionchange`), and the page re-sends its current one now and then so the server never silently loses a device.
 * That re-send (`resync`) only refreshes a device the server still has: one removed in Settings stays removed, and the page turns push off there.
 */
export function GET() { return out({ key: vapidPublicKey() }); }
export async function POST(req: Request) {
  if (req.headers.get("x-lifeos") !== "1") return out({ error: "Bad request" }, 400); // a custom header forces a CORS preflight, so other sites can't post here
  const b = (await req.json().catch(() => ({}))) as { sub?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; old?: unknown; label?: unknown; resync?: unknown };
  if (b.resync === true && !isKnownEndpoint(String(b.sub?.endpoint ?? ""))) return out({ ok: true, known: false });
  try { saveSubscription(b.sub ?? {}, typeof b.label === "string" ? b.label : "", typeof b.old === "string" ? b.old : undefined); return out({ ok: true, known: true }); }
  catch (e) { return out({ error: (e as Error).message }, 400); }
}
