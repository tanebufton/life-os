import { createRemoteJWKSet, jwtVerify } from "jose";
// Auth is delegated to Cloudflare Access (Zero Trust): the app trusts a signed token from Cloudflare, never the network location.
//  * Strong (recommended): LIFEOS_CF_TEAM_DOMAIN (e.g. "myteam" or "myteam.cloudflareaccess.com") + LIFEOS_CF_AUD (the Application Audience tag).
//    Every request must carry a valid, signed Access token: signature, issuer, audience and expiry are all checked.
//  * LIFEOS_ADMIN_EMAIL (optional, recommended when one Access application covers several sites, as they then share an AUD tag):
//    the token's email must also equal this address. Setting it without the two above refuses everything.
//  * LIFEOS_FAIL_CLOSED=1: refuse every request unless the strong settings are present (so a missing setting can never leave the app open).
//  * Basic: LIFEOS_REQUIRE_CF_ACCESS=1 only checks that an Access identity header is present (fine if the origin is reachable only through the tunnel).
// These paths carry their own credentials (API token / secret in the URL / bot secret), or reveal nothing (health), so they can't present an Access identity.
export const SELF_AUTH = ["/api/v1", "/api/inbound", "/api/ical", "/api/telegram", "/api/health"];
export type AccessInput = { pathname: string; jwt?: string | null; emailHeader?: string | null };
export type AccessResult = { ok: true } | { ok: false; reason: string };

const sets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const keysFor = (url: string) => { let s = sets.get(url); if (!s) { s = createRemoteJWKSet(new URL(url), { cooldownDuration: 30_000 }); sets.set(url, s); } return s; };

export async function checkAccess(i: AccessInput, env: Record<string, string | undefined> = process.env): Promise<AccessResult> {
  if (SELF_AUTH.some((p) => i.pathname.startsWith(p))) return { ok: true };
  const host = (env.LIFEOS_CF_TEAM_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, ""), aud = env.LIFEOS_CF_AUD ?? "";
  const team = host ? (host.includes(".") ? host : `${host}.cloudflareaccess.com`) : "", admin = (env.LIFEOS_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (team && aud) {
    if (!i.jwt) return { ok: false, reason: "no token" };
    try {
      const { payload } = await jwtVerify(i.jwt, keysFor(env.LIFEOS_CF_CERTS_URL ?? `https://${team}/cdn-cgi/access/certs`), { issuer: `https://${team}`, audience: aud, algorithms: ["RS256"], requiredClaims: ["exp"] });
      if (admin && String(payload.email ?? "").trim().toLowerCase() !== admin) return { ok: false, reason: "wrong user" };
      return { ok: true };
    } catch { return { ok: false, reason: "invalid token" }; }
  }
  if (admin || env.LIFEOS_FAIL_CLOSED === "1") return { ok: false, reason: "access not configured" }; // fail closed
  if (env.LIFEOS_REQUIRE_CF_ACCESS === "1" && !i.emailHeader) return { ok: false, reason: "no identity header" };
  return { ok: true };
}

/** The signed-in person's email from the Cloudflare Access token, for display only. By the time a page renders, the middleware has already checked the token's signature. */
export function accessEmail(jwt?: string | null): string | null {
  if (!jwt) return null;
  try { const p = JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8")); return typeof p.email === "string" ? p.email : null; } catch { return null; }
}
