import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { newNoteAction } from "@/lib/actions3";
import { listNotes } from "@/lib/notes";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";
const snippet = (b: string) => b.replace(/[#>*`_\[\]-]/g, "").replace(/\s+/g, " ").trim().slice(0, 140);
export default async function Notes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim(), notes = listNotes({ q: q || undefined });
  void renderMarkdown;
  return (
    <FeatureGate feature="notes">
      <div className="max-w-4xl">
        <PageHead title="Notes" sub="Markdown, with [[links]] between notes" right={<form action={newNoteAction}><button className="btn-primary">New note</button></form>} />
        <form className="mb-4"><input name="q" defaultValue={q} placeholder="Search notes…" aria-label="Search notes" className="field" /></form>
        <Panel i={0}><ul>{notes.map((n) => <li key={n.id} className="border-b last:border-b-0"><Link href={`/notes/${n.id}`} className="block px-4 py-3 hover:bg-raise/50"><div className="flex items-center gap-2"><span className="truncate text-[15px] font-medium">{n.title || "Untitled"}</span>{n.pinned ? <span className="lozenge bg-raise text-mute">Pinned</span> : null}<span className="ml-auto shrink-0 text-xs text-dim">{n.updated_at.slice(0, 10)}</span></div>{snippet(n.body) && <p className="mt-0.5 truncate text-[13px] text-mute">{snippet(n.body)}</p>}</Link></li>)}
          {!notes.length && <li className="px-4 py-12 text-center text-sm text-mute">{q ? "No notes match." : "No notes yet. Capture meeting notes, ideas, reference."}</li>}</ul></Panel>
      </div>
    </FeatureGate>
  );
}
