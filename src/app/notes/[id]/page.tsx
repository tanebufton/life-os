import Link from "next/link";
import { notFound } from "next/navigation";
import { FeatureGate } from "@/components/FeatureGate";
import { Panel } from "@/components/Panel";
import { NoteEditor } from "@/components/clientbits";
import { deleteNoteAction, saveNoteAction } from "@/lib/actions3";
import { backlinks, getNote } from "@/lib/notes";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const n = getNote(Number((await params).id)); if (!n) notFound();
  const links = Object.fromEntries((db.prepare("SELECT id, title FROM notes WHERE deleted_at IS NULL AND title!=''").all() as { id: number; title: string }[]).map((x) => [x.title.toLowerCase(), x.id])), back = backlinks(n);
  return (
    <FeatureGate feature="notes">
      <div className="max-w-4xl">
        <div className="mb-4 flex items-center justify-between text-[13px] text-mute"><Link href="/notes" className="hover:text-fg">‹ Notes</Link>
          <div className="flex gap-2"><form action={async () => { "use server"; await saveNoteAction(n.id, { pinned: !n.pinned }); }}><button className="btn !py-1 text-xs">{n.pinned ? "Unpin" : "Pin"}</button></form><form action={deleteNoteAction.bind(null, n.id)}><button className="btn !py-1 text-xs">Delete</button></form></div></div>
        <NoteEditor id={n.id} title={n.title} body={n.body} links={links} />
        {back.length > 0 && <Panel title="Linked from" count={back.length} className="mt-8" i={1}><ul>{back.map((b) => <li key={b.id} className="border-b last:border-b-0"><Link href={`/notes/${b.id}`} className="block px-4 py-2 text-[14px] hover:bg-raise/50">{b.title || "Untitled"}</Link></li>)}</ul></Panel>}
      </div>
    </FeatureGate>
  );
}
