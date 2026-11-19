import Link from "next/link";
import { FilterChip } from "@/components/chip";
import { FeatureGate } from "@/components/FeatureGate";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { newNoteAction } from "@/lib/actions3";
import { db } from "@/lib/db";
import { idsWithTag, tagCounts, tagsFor } from "@/lib/entitytags";
import { listNotes, noteTree } from "@/lib/notes";

export const dynamic = "force-dynamic";
const snippet = (b: string) => b.replace(/[#>*`_\[\]-]/g, "").replace(/\s+/g, " ").trim().slice(0, 140);
export default async function Notes({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; project?: string }> }) {
  const sp = await searchParams, q = (sp.q ?? "").trim(), tag = (sp.tag ?? "").trim(), project = Number(sp.project) || undefined;
  const notes = listNotes({ q: q || undefined, project, ids: tag ? idsWithTag("note", tag) : undefined }), tags = tagsFor("note", notes.map((n) => n.id)), allTags = tagCounts("note");
  const projects = db.prepare("SELECT id, name, color FROM projects WHERE archived=0 ORDER BY name").all() as { id: number; name: string; color: string }[], pname = new Map(projects.map((p) => [p.id, p.name]));
  const href = (o: { tag?: string; project?: number }) => { const u = new URLSearchParams(); if (q) u.set("q", q); if (o.tag) u.set("tag", o.tag); if (o.project) u.set("project", String(o.project)); const s = u.toString(); return `/notes${s ? "?" + s : ""}`; };
  return (
    <FeatureGate feature="notes">
      <div className="max-w-4xl">
        <PageHead title="Notes" sub="Markdown, with [[links]] between notes" right={<form action={newNoteAction}><button className="btn-primary">New note</button></form>} />
        <form className="mb-3"><input name="q" defaultValue={q} placeholder="Search notes…" aria-label="Search notes" className="field" />{tag && <input type="hidden" name="tag" value={tag} />}{project && <input type="hidden" name="project" value={project} />}</form>
        {(allTags.length > 0 || projects.length > 0) && <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <FilterChip href={href({})} active={!tag && !project}>All</FilterChip>
          {projects.filter((p) => db.prepare("SELECT 1 FROM notes WHERE project_id=? AND deleted_at IS NULL").get(p.id)).map((p) => <FilterChip key={p.id} href={href({ project: p.id, tag: tag || undefined })} active={project === p.id} dot={p.color}>{p.name}</FilterChip>)}
          {allTags.map((t) => <FilterChip key={t.name} href={href({ tag: t.name, project })} active={tag === t.name}>#{t.name}<span className="text-dim">{t.n}</span></FilterChip>)}</div>}
        <Panel i={0}><ul>{(q ? notes.map((x) => ({ ...x, depth: 0 })) : noteTree(notes)).map((n) => <li key={n.id} className="border-b last:border-b-0"><Link href={`/notes/${n.id}`} style={{ paddingLeft: 16 + n.depth * 24 }} className="block py-3 pr-4 hover:bg-raise/50"><div className="flex items-center gap-2">{n.depth > 0 && <span className="-ml-1 text-dim" aria-hidden>↳</span>}{n.icon ? <span aria-hidden>{n.icon}</span> : null}<span className="truncate text-[15px] font-medium">{n.title || "Untitled"}</span>{n.pinned ? <span className="lozenge bg-raise text-mute">Pinned</span> : null}{n.project_id && pname.get(n.project_id) ? <span className="lozenge bg-raise text-mute">{pname.get(n.project_id)}</span> : null}{(tags.get(n.id) ?? []).slice(0, 4).map((g) => <span key={g} className="text-xs text-accent">#{g}</span>)}<span className="ml-auto shrink-0 text-xs text-dim">{n.updated_at.slice(0, 10)}</span></div>{snippet(n.body) && <p className="mt-0.5 truncate text-[13px] text-mute">{snippet(n.body)}</p>}</Link></li>)}
          {!notes.length && <li className="px-4 py-12 text-center text-sm text-mute">{q || tag || project ? "No notes match." : "No notes yet. Capture meeting notes, ideas, reference."}</li>}</ul></Panel>
      </div>
    </FeatureGate>
  );
}
