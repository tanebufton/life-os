"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { addLinkAction, removeLinkAction } from "@/lib/actions5";
import type { Linked, LinkKind } from "@/lib/links";
import { Icon } from "./Icon";

const ICON: Record<string, string> = { task: "circleCheck", note: "notes", goal: "goals", person: "people" };
type Found = { kind: LinkKind; id: number; title: string; meta?: string };
/** Links between a task, note, goal or person and anything else. Shows both directions; add with a search box. */
export function LinksPanel({ kind, id, links }: { kind: LinkKind; id: number; links: Linked[] }) {
  const router = useRouter(), [adding, setAdding] = useState(false), [q, setQ] = useState(""), [found, setFound] = useState<Found[]>([]), [, start] = useTransition();
  useEffect(() => {
    if (!adding || q.trim().length < 2) { setFound([]); return; }
    const c = new AbortController(), t = setTimeout(() => fetch(`/api/search?q=${encodeURIComponent(q)}&kinds=task,note,goal,person&limit=6`, { signal: c.signal }).then((r) => r.json()).then((j) => setFound((j.groups ?? []).flatMap((g: { items: Found[] }) => g.items).filter((h: Found) => !(h.kind === kind && h.id === id) && !links.some((l) => l.kind === h.kind && l.id === h.id)))).catch(() => {}), 150);
    return () => { clearTimeout(t); c.abort(); };
  }, [q, adding, kind, id, links]);
  const add = (h: Found) => start(async () => { const r = await addLinkAction(kind, id, h.kind, h.id); if (!r.ok) toast(r.error); else { setQ(""); setFound([]); setAdding(false); router.refresh(); } });
  const remove = (l: Linked) => start(async () => { const r = await removeLinkAction(kind, id, l.kind, l.id); if (!r.ok) toast(r.error); else router.refresh(); });
  return (
    <section aria-label="Links" className="mt-6">
      <div className="mb-1.5 flex items-center gap-3"><h2 className="text-[13px] font-semibold">Linked <span className="font-normal text-dim">{links.length || ""}</span></h2>{!adding && <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-accent hover:underline"><Icon name="plus" size={12} />Link something</button>}</div>
      {links.length > 0 && <ul className="mb-2 divide-y rounded-lg border bg-panel">{links.map((l) => (
        <li key={`${l.kind}${l.id}`} className="group flex items-center gap-2 px-3 py-1.5 text-[13.5px]"><Icon name={ICON[l.kind]} size={14} className="text-mute" /><Link href={l.href} className={`min-w-0 flex-1 truncate hover:underline ${l.meta === "done" ? "text-dim line-through" : ""}`}>{l.title}</Link><span className="text-xs capitalize text-dim">{l.kind}</span>
          <button aria-label={`Remove link to ${l.title}`} onClick={() => remove(l)} className="rounded p-0.5 text-dim opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100"><Icon name="x" size={13} /></button></li>))}</ul>}
      {adding && (
        <div className="relative max-w-md"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setAdding(false); setQ(""); } }} placeholder="Search tasks, notes, goals, people…" aria-label="Find something to link" className="field" />
          {q.trim().length >= 2 && <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-panel p-1 shadow-lg">{found.map((h) => <li key={`${h.kind}${h.id}`}><button onClick={() => add(h)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-raise"><Icon name={ICON[h.kind]} size={14} className="text-mute" /><span className="min-w-0 flex-1 truncate">{h.title}</span><span className="text-xs capitalize text-dim">{h.kind}</span></button></li>)}{!found.length && <li className="px-2.5 py-2 text-xs text-mute">Nothing to link.</li>}</ul>}
          <button className="mt-1 text-xs text-mute hover:text-fg" onClick={() => { setAdding(false); setQ(""); }}>Cancel</button></div>)}
    </section>
  );
}
