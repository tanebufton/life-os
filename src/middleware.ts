import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
// Auth is delegated to Cloudflare Access. Two modes:
//  * Strong (recommended): set LIFEOS_CF_TEAM_DOMAIN (e.g. "myteam" or "myteam.cloudflareaccess.com") and LIFEOS_CF_AUD (the Application Audience tag).
//    Every request must carry a valid, signed Access JWT, so a request that reaches the origin some other way can't pretend to be you.
//  * Basic: LIFEOS_REQUIRE_CF_ACCESS=1 only checks that an Access identity header is present (fine if the origin is reachable only through the tunnel).
// These paths carry their own credentials (API token / secret in the URL / bot secret), or reveal nothing (health), so they can't present an Access identity.
const SELF_AUTH = ["/api/v1", "/api/inbound", "/api/ical", "/api/telegram", "/api/health"];
const host = (process.env.LIFEOS_CF_TEAM_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, ""), aud = process.env.LIFEOS_CF_AUD ?? "";
const team = host ? (host.includes(".") ? host : `${host}.cloudflareaccess.com`) : "";
const jwks = team ? createRemoteJWKSet(new URL(process.env.LIFEOS_CF_CERTS_URL ?? `https://${team}/cdn-cgi/access/certs`), { cooldownDuration: 30_000 }) : null;

export async function middleware(req: NextRequest) {
  if (SELF_AUTH.some((p) => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();
  if (jwks && aud) {
    const token = req.headers.get("cf-access-jwt-assertion") ?? req.cookies.get("CF_Authorization")?.value;
    if (!token) return new NextResponse("Forbidden", { status: 403 });
    try { await jwtVerify(token, jwks, { issuer: `https://${team}`, audience: aud }); } catch { return new NextResponse("Forbidden", { status: 403 }); }
  } else if (process.env.LIFEOS_REQUIRE_CF_ACCESS === "1" && !req.headers.get("cf-access-authenticated-user-email")) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.next();
}
