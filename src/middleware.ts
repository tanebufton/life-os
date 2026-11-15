import { NextRequest, NextResponse } from "next/server";
// Auth is delegated to Cloudflare Access. If LIFEOS_REQUIRE_CF_ACCESS=1, reject
// requests that did not come through the tunnel (no Access identity header).
export function middleware(req: NextRequest) {
  if (process.env.LIFEOS_REQUIRE_CF_ACCESS === "1" && !req.headers.get("cf-access-authenticated-user-email")) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.next();
}
