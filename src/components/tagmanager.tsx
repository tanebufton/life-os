"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTagAction, pruneTagsAction, renameTagAction, setTagColorAction } from "@/lib/actions5";
import type { TagInfo } from "@/lib/tags";
import { hue } from "@/lib/ui";

const toHex = (rgb: string) => "#" + rgb.split(" ").map((n) => Number(n).toString(16).padStart(2, "0")).join("");
export function TagManager({ tags }: { tags: TagInfo[] }) {
  const [busy, start] = useTransition(), [q, setQ] = useState(""), [confirm, setConfirm] = useState<string | null>(null), timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const run = (f: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => { const r = await f(); toast(r.ok ? (r.message ?? "Saved") : (r.error ?? "That didn't work")); });
  const shown = tags.filter((t) => t.name.includes(q.trim().toLowerCase().replace(/^#/, "")));
  const unused = tags.filter((t) => t.total === 0).length;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tags…" aria-label="Filter tags" className="field !w-64" />{unused > 0 && <button className="btn !h-8 text-xs" disabled={busy} onClick={() => run(pruneTagsAction)}>Remove {unused} unused</button>}</div>
      <ul className="card overflow-hidden">{shown.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5 last:border-b-0">
          <input type="color" defaultValue={t.color ?? toHex(hue(t.name))} aria-label={`Colour for ${t.name}`} title={t.color ? "Custom colour" : "Automatic colour. Pick one to set it."} className="h-7 w-8 cursor-pointer rounded border bg-transparent p-0.5" onChange={(e) => { const v = e.target.value; clearTimeout(timers.current[t.name]); timers.current[t.name] = setTimeout(() => run(() => setTagColorAction(t.name, v)), 600); }} />
          <input defaultValue={t.name} aria-label={`Rename ${t.name}`} maxLength={40} className="field !w-44 !py-1" onBlur={(e) => { const v = e.target.value.trim(); if (v && v.replace(/^#/, "").toLowerCase() !== t.name) run(() => renameTagAction(t.name, v)); else e.target.value = t.name; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
          <span className="flex flex-1 flex-wrap items-center gap-x-3 text-xs text-mute">
            {t.tasks > 0 && <Link href={`/tasks?tag=${t.name}`} className="hover:text-fg hover:underline">{t.tasks} task{t.tasks === 1 ? "" : "s"}</Link>}{t.notes > 0 && <Link href={`/notes?tag=${t.name}`} className="hover:text-fg hover:underline">{t.notes} note{t.notes === 1 ? "" : "s"}</Link>}
            {t.goals > 0 && <span>{t.goals} goal{t.goals === 1 ? "" : "s"}</span>}{t.total === 0 && <span className="text-dim">Unused</span>}</span>
          {t.color && <button className="text-xs text-mute hover:text-fg" onClick={() => run(() => setTagColorAction(t.name, null))}>Reset colour</button>}
          {confirm === t.name ? <span className="flex items-center gap-2 text-xs"><span>{t.total ? `Remove from ${t.total} item${t.total === 1 ? "" : "s"}?` : "Delete?"}</span><button className="btn !h-7 text-danger" disabled={busy} onClick={() => run(async () => { const r = await deleteTagAction(t.name); setConfirm(null); return r; })}>Delete</button><button className="text-mute underline" onClick={() => setConfirm(null)}>Cancel</button></span>
            : <button aria-label={`Delete ${t.name}`} className="text-xs text-dim hover:text-danger" onClick={() => setConfirm(t.name)}>Delete</button>}
        </li>))}
        {!shown.length && <li className="px-4 py-10 text-center text-sm text-mute">{tags.length ? "No tags match." : "No tags yet. Add #tags to tasks, or tags to notes, and goals."}</li>}</ul>
      <p className="mt-3 text-xs text-dim">Rename a tag to the name of another tag to merge them. Deleting a tag only removes the tag, never the items.</p>
    </div>
  );
}
