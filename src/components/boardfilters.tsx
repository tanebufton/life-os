"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/** Filter and sort the board. Choices live in the address, so they can be bookmarked and survive a refresh. */
export function BoardFilters({ tags }: { tags: string[] }) {
  const path = usePathname(), router = useRouter(), sp = useSearchParams(), [q, setQ] = useState(sp.get("q") ?? "");
  const set = (k: string, v: string) => { const u = new URLSearchParams(sp.toString()); if (v) u.set(k, v); else u.delete(k); router.replace(`${path}?${u.toString()}`); };
  useEffect(() => { const t = setTimeout(() => { if ((sp.get("q") ?? "") !== q.trim()) set("q", q.trim()); }, 300); return () => clearTimeout(t); }); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = "field !w-auto !py-1 text-[13px]", active = ["q", "tag", "priority", "due", "sort"].some((k) => sp.get(k));
  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter the board">
      <label className="relative"><Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter cards" aria-label="Filter cards" className="field !w-44 !py-1 !pl-8 text-[13px]" /></label>
      <select aria-label="Tag" value={sp.get("tag") ?? ""} onChange={(e) => set("tag", e.target.value)} className={sel}><option value="">Any tag</option>{tags.map((t) => <option key={t} value={t}>#{t}</option>)}</select>
      <select aria-label="Priority" value={sp.get("priority") ?? ""} onChange={(e) => set("priority", e.target.value)} className={sel}><option value="">Any priority</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>
      <select aria-label="Due" value={sp.get("due") ?? ""} onChange={(e) => set("due", e.target.value)} className={sel}><option value="">Any date</option><option value="overdue">Overdue</option><option value="today">Today</option><option value="week">Next 7 days</option><option value="none">No date</option></select>
      <select aria-label="Sort" value={sp.get("sort") ?? ""} onChange={(e) => set("sort", e.target.value)} className={sel}><option value="">Manual order</option><option value="due">Due date</option><option value="priority">Priority</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
      {active && <button className="text-xs text-mute hover:text-fg" onClick={() => { setQ(""); { const u = new URLSearchParams(); for (const k of ["project", "tab"]) if (sp.get(k)) u.set(k, sp.get(k)!); router.replace(u.toString() ? `${path}?${u}` : path); } }}>Clear</button>}
    </div>
  );
}
