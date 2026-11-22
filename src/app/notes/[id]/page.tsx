import Link from "next/link";
import { notFound } from "next/navigation";
import { FeatureGate } from "@/components/FeatureGate";
import { Panel } from "@/components/Panel";
import { NoteEditor } from "@/components/clientbits";
import { deleteNoteAction, saveNoteAction } from "@/lib/actions3";
import { backlinks, getNote, noteAncestors, noteChildren, noteDescendants, noteTree } from "@/lib/notes";
import { FavouriteButton } from "@/components/favbutton";
import { NoteIcon, NoteInside } from "@/components/noteorg";
import { Icon } from "@/components/Icon";
import { isFavourite } from "@/lib/favourites";
import { newSubpageAction } from "@/lib/actions5";
import { db } from "@/lib/db";
import { History } from "@/components/history";
import { LinksPanel } from "@/components/links";
import { listLinks } from "@/lib/links";
import { NoteProjectField, TagField } from "@/components/meta";
import { entityTags } from "@/lib/entitytags";
import { ExportMenu } from "@/components/exportmenu";

export const dynamic = "force-dynamic";
export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const n = getNote(Number((await params).id)); if (!n) notFound();
  const links = Object.fromEntries((db.prepare("SELECT id, title FROM notes WHERE deleted_at IS NULL AND title!=''").all() as { id: number; title: string }[]).map((x) => [x.title.toLowerCase(), x.id])), back = backlinks(n), projects = db.prepare("SELECT id, name FROM projects WHERE archived=0 ORDER BY name").all() as { id: number; name: string }[];
  const crumbs = noteAncestors(n.id), kids = noteChildren(n.id), banned = new Set([n.id, ...noteDescendants(n.id)]);
  const options = noteTree((db.prepare("SELECT id, title, parent_id FROM notes WHERE deleted_at IS NULL ORDER BY title COLLATE NOCASE").all() as { id: number; title: string; parent_id: number | null }[]).filter((x) => !banned.has(x.id)));
  return (
    <FeatureGate feature="notes">
      <div className="max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3 text-[13px] text-mute">
          <nav aria-label="Page path" className="flex min-w-0 flex-wrap items-center gap-1"><Link href="/notes" className="hover:text-fg">Notes</Link>{crumbs.map((c) => <span key={c.id} className="flex items-center gap-1"><span className="text-dim">/</span><Link href={`/notes/${c.id}`} className="max-w-[12rem] truncate hover:text-fg">{c.icon} {c.title || "Untitled"}</Link></span>)}</nav>
          <div className="flex shrink-0 gap-2">
            <ExportMenu items={[{ label: "Save as PDF…", href: `/notes/${n.id}/print`, newTab: true }, ...(kids.length ? [{ label: "Save as PDF with sub-pages…", href: `/notes/${n.id}/print?sub=1`, newTab: true }] : []), { label: "Download Markdown (.md)", href: `/api/notes/${n.id}/export`, download: true }]} />
            <FavouriteButton kind="note" id={n.id} on={isFavourite("note", n.id)} />
            <form action={async () => { "use server"; await saveNoteAction(n.id, { pinned: !n.pinned }); }}><button className="btn !px-2.5" aria-pressed={!!n.pinned} aria-label={n.pinned ? "Unpin from the top of the list" : "Pin to the top of the list"} title={n.pinned ? "Unpin from the top of the list" : "Pin to the top of the list"}><Icon name="pin" size={15} className={n.pinned ? "text-accent" : "text-mute"} /></button></form>
            <form action={deleteNoteAction.bind(null, n.id)}><button className="btn !px-2.5 hover:!text-danger" aria-label="Delete note" title="Delete note"><Icon name="trash" size={15} className="text-mute" /></button></form>
          </div>
        </div>
        <NoteEditor id={n.id} title={n.title} body={n.body} rev={n.rev} links={links} lead={<NoteIcon id={n.id} icon={n.icon} />}
          meta={<div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-raise/30 px-3 py-1.5"><NoteProjectField id={n.id} value={n.project_id} projects={projects} /><NoteInside id={n.id} parentId={n.parent_id} options={options} /><TagField kind="note" id={n.id} value={entityTags("note", n.id)} /></div>} />
        <Panel title="Sub-pages" count={kids.length} className="mt-8" i={1} right={<form action={newSubpageAction.bind(null, n.id)}><button className="font-medium text-accent hover:underline">Add sub-page</button></form>}>
          <ul>{kids.map((k) => <li key={k.id} className="border-b last:border-b-0"><Link href={`/notes/${k.id}`} className="flex items-center gap-2 px-4 py-2 text-[14px] hover:bg-raise/50"><span className="w-5 text-center">{k.icon || "📄"}</span><span className="truncate">{k.title || "Untitled"}</span></Link></li>)}
            {!kids.length && <li className="px-4 py-4 text-sm text-mute">No sub-pages. Use them to break a big page into a tree, like a wiki.</li>}</ul></Panel>
        {back.length > 0 && <Panel title="Linked from" count={back.length} className="mt-8" i={1}><ul>{back.map((b) => <li key={b.id} className="border-b last:border-b-0"><Link href={`/notes/${b.id}`} className="block px-4 py-2 text-[14px] hover:bg-raise/50">{b.title || "Untitled"}</Link></li>)}</ul></Panel>}
        <LinksPanel kind="note" id={n.id} links={listLinks("note", n.id)} />
        <History entity="note" id={n.id} noteId={n.id} />
      </div>
    </FeatureGate>
  );
}
