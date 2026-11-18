import { exportAll, tasksCsv } from "@/lib/exporter";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const fmt = new URL(req.url).searchParams.get("format") ?? "json", stamp = new Date().toISOString().slice(0, 10);
  const dl = (body: BodyInit, type: string, name: string) => new Response(body, { headers: { "content-type": type, "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });
  if (fmt === "csv") return dl(tasksCsv(), "text/csv; charset=utf-8", `lifeos-tasks-${stamp}.csv`);
  if (fmt === "db") return dl(new Uint8Array(db.serialize()), "application/vnd.sqlite3", `lifeos-backup-${stamp}.db`);
  return dl(JSON.stringify(exportAll(), null, 2), "application/json", `lifeos-export-${stamp}.json`);
}
