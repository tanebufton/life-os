"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkAction } from "@/lib/actions3";

type Row = { id: number; title: string; due: string | null; project: string | null };
const ACTIONS = [["done", "Complete"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["nextweek", "Next week"], ["someday", "No date"], ["high", "High priority"], ["delete", "Delete"]] as const;
/** Select-many list with a sticky action bar. Entered via “Select” on My tasks. */
export function BulkList({ rows, exit }: { rows: Row[]; exit: string }) {
  const [sel, setSel] = useState<Set<number>>(new Set()), [p, go] = useTransition();
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const run = (a: (typeof ACTIONS)[number][0]) => go(async () => { const n = sel.size; await bulkAction([...sel], a); setSel(new Set()); toast(`${a === "delete" ? "Deleted" : "Updated"} ${n} task${n === 1 ? "" : "s"}`); });
  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-[13px]"><button className="text-accent" onClick={() => setSel(sel.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}>{sel.size === rows.length ? "Clear" : "Select all"}</button><span className="text-mute">{sel.size} selected</span><Link href={exit} className="ml-auto text-mute hover:text-fg">Done</Link></div>
      <ul className="card overflow-hidden">{rows.map((r) => <li key={r.id} className="border-b last:border-b-0"><label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-raise/50"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4" /><span className="min-w-0 flex-1 truncate text-[14px]">{r.title}</span><span className="shrink-0 text-xs text-dim">{r.project ?? ""} {r.due ?? ""}</span></label></li>)}</ul>
      {sel.size > 0 && <div className="sticky bottom-20 z-20 mt-4 flex flex-wrap gap-1.5 rounded-xl border bg-panel p-2 shadow-[0_8px_30px_rgb(0_0_0/0.15)] md:bottom-4">{ACTIONS.map(([k, l]) => <button key={k} disabled={p} onClick={() => run(k)} className={`btn !py-1.5 text-[13px] ${k === "delete" ? "!text-danger" : ""}`}>{l}</button>)}</div>}
    </div>
  );
}
