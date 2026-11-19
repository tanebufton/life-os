export const dynamic = "force-dynamic";
/** Behind Cloudflare Access, so it only answers with JSON while the session is valid. The page uses it to tell "session expired" from "offline". */
export function GET() { return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } }); }
