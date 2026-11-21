import { NextRequest, NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
// See src/lib/access.ts for how requests are checked.
export async function middleware(req: NextRequest) {
  const r = await checkAccess({ pathname: req.nextUrl.pathname, jwt: req.headers.get("cf-access-jwt-assertion") ?? req.cookies.get("CF_Authorization")?.value, emailHeader: req.headers.get("cf-access-authenticated-user-email") });
  return r.ok ? NextResponse.next() : new NextResponse("Forbidden", { status: 403 });
}
