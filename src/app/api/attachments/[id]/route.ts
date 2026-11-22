import { getAttachment } from "@/lib/attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Hands a stored file back as plain bytes. The type comes from what we checked at upload, never from the browser. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = getAttachment(Number((await params).id));
  if (!a) return new Response("Not found", { status: 404 });
  const image = a.mime.startsWith("image/"), pdf = a.mime === "application/pdf", download = new URL(req.url).searchParams.has("download");
  const headers: Record<string, string> = {
    "Content-Type": a.mime, "Content-Length": String(a.data.length), "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", "Cache-Control": "private, max-age=300",
    "Content-Disposition": `${(image || pdf) && !download ? "inline" : "attachment"}; filename="${a.name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(a.name)}`,
  };
  if (!pdf) headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"; // even if something odd got through, it can't run script here
  return new Response(new Uint8Array(a.data), { headers });
}
