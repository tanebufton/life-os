import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { makeZip } from "@/lib/zip";

export const dynamic = "force-dynamic";
const walk = (dir: string, base = ""): { name: string; data: Buffer }[] =>
  readdirSync(dir).flatMap((n) => { const p = path.join(dir, n), rel = base ? `${base}/${n}` : n; return statSync(p).isDirectory() ? walk(p, rel) : [{ name: `lifeos-extension/${rel}`, data: readFileSync(p) }]; });

/** The Chrome extension as a zip, so it can be installed from the app itself (Chrome → Extensions → Load unpacked). */
export function GET() {
  const dir = path.join(process.cwd(), "extension");
  try { const zip = makeZip(walk(dir)); return new Response(new Uint8Array(zip), { headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="lifeos-extension.zip"', "cache-control": "no-store" } }); }
  catch { return new Response("The extension files aren't in this install.", { status: 404 }); }
}
