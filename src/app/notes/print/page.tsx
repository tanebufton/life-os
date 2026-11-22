import { AutoPrint } from "@/components/autoprint";
import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { listNotes } from "@/lib/notes";

export const dynamic = "force-dynamic";
/** Every note (or one project's notes), one per page, ready to save as a single PDF. */
export default async function NotesPrint({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const project = Number((await searchParams).project) || undefined, notes = listNotes({ project, limit: 1000 });
  const links = Object.fromEntries((db.prepare("SELECT id, title FROM notes WHERE deleted_at IS NULL AND title!=''").all() as { id: number; title: string }[]).map((x) => [x.title.toLowerCase(), x.id]));
  return (
    <div className="mx-auto max-w-3xl">
      <AutoPrint />
      <div className="mb-6 flex items-center justify-between border-b pb-3" data-no-print><p className="text-sm text-mute">{notes.length} note{notes.length === 1 ? "" : "s"}, one per page. Use your browser&apos;s print dialog and choose “Save as PDF”.</p><button id="print-btn" className="btn-primary">Print / Save as PDF</button></div>
      {notes.map((n) => (
        <article key={n.id} className="break-before-page first:break-before-auto mb-10">
          <h1 className="mb-1 text-3xl font-bold">{n.icon ? `${n.icon} ` : ""}{n.title || "Untitled"}</h1>
          <p className="mb-4 text-xs text-mute">Updated {n.updated_at.slice(0, 10)}</p>
          <div className="prose-note" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.body, (x) => links[x.toLowerCase()] ?? null) }} />
        </article>))}
      {!notes.length && <p className="text-mute">No notes yet.</p>}
    </div>
  );
}
