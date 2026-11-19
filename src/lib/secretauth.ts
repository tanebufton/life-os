import { authBlocked, authFailed, clientIp } from "./ratelimit";
import { safeEq } from "./tokens";

const NOSTORE = { "cache-control": "no-store", "referrer-policy": "no-referrer" };
/** For endpoints whose credential is a secret in the URL or a header. Bad guesses are throttled per address; the response never says why it failed. */
export function secretGate(req: Request, provided: string | null | undefined, expected: string): Response | null {
  const ip = clientIp(req), b = authBlocked(ip);
  if (b.blocked) return new Response("Too many attempts", { status: 429, headers: { ...NOSTORE, "retry-after": String(b.retryAfter) } });
  if (provided && expected && safeEq(provided, expected)) return null;
  authFailed(ip); return new Response("Not found", { status: 404, headers: NOSTORE });
}
export const noStore = NOSTORE;
