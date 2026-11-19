import { isOn } from "@/lib/features";
import { buildIcs } from "@/lib/ical";
import { icalSecret } from "@/lib/tokens";
import { secretGate, noStore } from "@/lib/secretauth";

export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  if (!isOn("api")) return new Response("Calendar feed is turned off", { status: 404 });
  const s = (await params).secret.replace(/\.ics$/i, "");
  const gate = secretGate(req, s, icalSecret()); if (gate) return gate;
  return new Response(buildIcs((process.env.LIFEOS_BASE_URL ?? "").replace(/\/$/, "")), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", "content-disposition": 'inline; filename="lifeos.ics"' } });
}
