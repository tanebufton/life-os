import { notFound } from "next/navigation";
import { AutoPrint } from "@/components/autoprint";
import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { entityTags } from "@/lib/entitytags";
import { getNote, noteChildren, noteDescendants, type Note } from "@/lib/notes";

export const dynamic = "force-dynamic";
const Page = ({ n, depth, links, projects }: { n: Note; depth: number; links: Record<string, number>; projects: Map<number, string> }) => (
  <article className="break-before-page first:break-before-auto">
    <h1 className={`mb-1 font-bold ${depth ? "text-xl" : "text-3xl"}`}>{n.icon ? `${n.icon} ` : ""}{n.title || "Untitled"}</h1>
    <p className="mb-4 text-xs text-mute">{[n.project_id ? projects.get(n.project_id) : "", entityTags("note", n.id).map((t) => `#${t}`).join(" "), `Updated ${n.updated_at.slice(0, 10)}`].filter(Boolean).join(" · ")}</p>
    <div className="prose-note" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.body, (x) => links[x.toLowerCase()] ?? null) }} />
  </article>
);
/** A clean, printable page for one note (and, with ?sub=1, its sub-pages). It opens the print dialog: choose "Save as PDF". */
export default async function NotePrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sub?: string }> }) {
  const n = getNote(Number((await params).id)); if (!n) notFound();
  const sub = (await searchParams).sub === "1", kids = sub ? noteDescendants(n.id).map((i) => getNote(i)).filter(Boolean) as Note[] : [];
  const links = Object.fromEntries((db.prepare("SELECT id, title FROM notes WHERE deleted_at IS NULL AND title!=''").all() as { id: number; title: string }[]).map((x) => [x.title.toLowerCase(), x.id]));
  const projects = new Map((db.prepare("SELECT id, name FROM projects").all() as { id: number; name: string }[]).map((p) => [p.id, p.name]));
  return (
    <div className="mx-auto max-w-3xl">
      <AutoPrint />
      <div className="mb-6 flex items-center justify-between border-b pb-3" data-no-print><p className="text-sm text-mute">Use your browser&apos;s print dialog and choose “Save as PDF”.{noteChildren(n.id).length && !sub ? " Sub-pages aren't included here." : ""}</p><button id="print-btn" className="btn-primary">Print / Save as PDF</button></div>
      <div className="space-y-10"><Page n={n} depth={0} links={links} projects={projects} />{kids.map((k) => <Page key={k.id} n={k} depth={1} links={links} projects={projects} />)}</div>
    </div>
  );
}
