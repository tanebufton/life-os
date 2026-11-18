import { isOn } from "@/lib/features";
import { buildIcs } from "@/lib/ical";
import { icalSecret, safeEq } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ secret: string }> }) {
  if (!isOn("api")) return new Response("Calendar feed is turned off", { status: 404 });
  const s = (await params).secret.replace(/\.ics$/i, "");
  if (!safeEq(s, icalSecret())) return new Response("Not found", { status: 404 });
  return new Response(buildIcs((process.env.LIFEOS_BASE_URL ?? "").replace(/\/$/, "")), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store", "content-disposition": 'inline; filename="lifeos.ics"' } });
}
