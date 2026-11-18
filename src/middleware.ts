import { NextRequest, NextResponse } from "next/server";
// Auth is delegated to Cloudflare Access. If LIFEOS_REQUIRE_CF_ACCESS=1, reject
// requests that did not come through the tunnel (no Access identity header).
// These carry their own credentials (API token / secret in the URL), so they can't present an Access identity.
const SELF_AUTH = ["/api/v1", "/api/inbound", "/api/ical"];
export function middleware(req: NextRequest) {
  if (SELF_AUTH.some((p) => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();
  if (process.env.LIFEOS_REQUIRE_CF_ACCESS === "1" && !req.headers.get("cf-access-authenticated-user-email")) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.next();
}
