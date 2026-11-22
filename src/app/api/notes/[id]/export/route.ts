import { getNote } from "@/lib/notes";
import { entityTags } from "@/lib/entitytags";

export const dynamic = "force-dynamic";
/** One note as a Markdown file. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const n = getNote(Number((await params).id)); if (!n) return new Response("Not found", { status: 404 });
  const tags = entityTags("note", n.id), md = `# ${n.title || "Untitled"}\n\n${tags.length ? tags.map((t) => `#${t}`).join(" ") + "\n\n" : ""}${n.body}\n`;
  const name = (n.title || "note").replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "note";
  return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.md"`, "X-Content-Type-Options": "nosniff" } });
}
