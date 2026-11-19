export const dynamic = "force-dynamic";
/** Unauthenticated liveness check for Docker. Reveals nothing. */
export function GET() { return new Response("ok", { headers: { "cache-control": "no-store" } }); }
