import Link from "next/link";
import { AddTaskRow } from "@/components/addrow";
import { FilterChip } from "@/components/chip";
import { Icon } from "@/components/Icon";
import { PageHead, TaskGroups } from "@/components/tasks";
import { saveFilterAction } from "@/lib/actions3";
import { listFilters } from "@/lib/misc";
import { hasOperators, searchAll } from "@/lib/search";
import { searchTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
const OPS = [["#tag", "has the tag"], ["@project", "in a project"], ["due:today", "today, tomorrow, week, overdue, none, or a date"], ["is:done", "done, any, doing, recurring, overdue"], ["!high", "high priority (!low too)"], ["no:date", "no date, project or tag"], ["has:subtasks", "notes, link, time, estimate"], ["source:email", "api, share, manual"]];
const ICON: Record<string, string> = { note: "notes", goal: "goals", person: "people", memo: "mic", project: "list" };
/** Wrap matches in <mark>. Text is escaped first, so search words can't inject markup. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  const parts = text.split(new RegExp(`(${terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig"));
  return <>{parts.map((p, i) => (terms.some((t) => t && p.toLowerCase() === t.toLowerCase()) ? <mark key={i} className="rounded bg-warn/25 px-0.5 text-fg">{p}</mark> : <span key={i}>{p}</span>))}</>;
}
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim(), ops = hasOperators(q), terms = q.split(/\s+/).filter((t) => t && !/^(#|@|!|\w+:)/.test(t));
  const tasks = q ? searchTasks(q, 100) : [], others = q && !ops ? searchAll(q, { limit: 25, kinds: ["note", "goal", "person", "memo", "project"] }).groups : [];
  const count = tasks.length + others.reduce((n, g) => n + g.items.length, 0), filters = listFilters();
  return (
    <div className="max-w-4xl">
      <PageHead title="Search" sub={q ? `${count} ${count === 1 ? "result" : "results"}` : "Search tasks, notes, goals, people and voice memos, or filter tasks"} />
      <form className="mb-6"><div className="flex items-center gap-2.5 rounded-xl border bg-panel px-3.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25"><Icon name="search" size={17} className="text-mute" />
        <input name="q" defaultValue={q} autoFocus placeholder="e.g. venue, or invoice #bills due:week" className="w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-dim" /></div></form>
      {q && <form action={saveFilterAction} className="-mt-3 mb-5 flex items-center gap-2 text-[13px]"><input type="hidden" name="query" value={q} /><input name="name" required placeholder="Save this search as…" aria-label="Filter name" className="field !w-56 !py-1" /><button className="btn !py-1">Save filter</button></form>}
      {!q && filters.length > 0 && <div className="mb-5 flex flex-wrap gap-1.5">{filters.map((f) => <FilterChip key={f.id} href={`/search?q=${encodeURIComponent(f.query)}`} active={false}>{f.name}</FilterChip>)}</div>}
      {q ? (
        <div className="space-y-6">
          {others.map((g) => (
            <section key={g.kind}><h2 className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold">{g.label}<span className="font-normal text-dim">{g.items.length}</span></h2>
              <ul className="card overflow-hidden">{g.items.map((h) => (
                <li key={`${h.kind}${h.id}`} className="border-b last:border-b-0"><Link href={h.href} className="block px-4 py-2.5 hover:bg-raise/50"><div className="flex items-center gap-2"><Icon name={ICON[h.kind] ?? "search"} size={15} className="text-mute" /><span className="truncate text-[14px] font-medium"><Marked text={h.title} terms={terms} /></span>{h.meta && <span className="ml-auto shrink-0 text-xs text-dim">{h.meta}</span>}</div>
                  {h.snippet && <p className="mt-0.5 line-clamp-2 pl-[23px] text-[13px] text-mute"><Marked text={h.snippet} terms={terms} /></p>}</Link></li>))}</ul></section>))}
          <section>{others.length > 0 && <h2 className="mb-1.5 text-[13px] font-semibold">Tasks <span className="font-normal text-dim">{tasks.length}</span></h2>}
            <TaskGroups groups={[{ label: others.length ? "" : "Results", tasks }]} empty={count ? <>No tasks match “{q}”.</> : <>Nothing matches “{q}”. Add <code className="rounded bg-raise px-1">is:any</code> to include completed tasks.</>} /></section>
          <AddTaskRow />
        </div>
      ) : (
        <dl className="grid gap-x-6 gap-y-2.5 rounded-xl border p-4 text-[13px] sm:grid-cols-[auto_1fr]">{OPS.map(([k, d]) => <div key={k} className="contents"><dt className="font-medium text-accent">{k}</dt><dd className="text-mute">{d}</dd></div>)}</dl>)}
    </div>
  );
}
