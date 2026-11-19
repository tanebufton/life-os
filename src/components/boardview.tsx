import Link from "next/link";
import { Board } from "@/components/board";
import { BoardFilters } from "@/components/boardfilters";
import { FilterChip } from "@/components/chip";
import { ColumnsEditor, DoneWindow } from "@/components/columns";
import { getSetting } from "@/lib/settings";
import { Panel } from "@/components/Panel";
import { db, Project } from "@/lib/db";
import { hasCustomColumns, listStatuses } from "@/lib/statuses";
import { byPosition, queryTasks } from "@/lib/tasks";
import { today } from "@/lib/time";

export type BoardParams = { project?: string; columns?: string; done?: string; q?: string; tag?: string; priority?: string; due?: string; sort?: string };
/** The board itself (filters, columns, cards). Used by /board and by the Board tab inside a project. `base` is the page it sits on. */
export function BoardView({ sp, lockProject, base }: { sp: BoardParams; lockProject?: number; base: string; extra?: string; actions?: (columnsHref: string) => React.ReactNode }) {
  const project = lockProject ?? (Number(sp.project) || undefined);
  const projects = db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY name").all() as Project[];
  const current = project ? projects.find((p) => p.id === project) : undefined, pid = current ? current.id : null;
  const columns = listStatuses(pid), custom = hasCustomColumns(pid);
  // "All projects" shows the default columns. Projects with their own columns have their own board, linked below.
  const own = projects.filter((p) => hasCustomColumns(p.id));
  const keep = (t: { project_id: number | null }) => (pid !== null ? true : !t.project_id || !own.some((p) => p.id === t.project_id));
  const days = Number(getSetting("board_done_days") ?? 7), showAll = sp.done === "all", cutoff = days > 0 && !showAll ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19).replace("T", " ") : "";
  const open = queryTasks({ project: pid ?? undefined }).filter(keep);
  const allDone = queryTasks({ project: pid ?? undefined, state: "done", limit: 400 }).filter(keep), done = allDone.filter((t) => !cutoff || (t.done_at ?? "") >= cutoff).slice(0, showAll || !days ? 200 : 150), hidden = allDone.length - done.length;
  // filters and sort (manual order is the default; the others are for looking, so dragging within them is just for this view)
  const t0 = today(), q = (sp.q ?? "").trim().toLowerCase(), week = new Date(Date.parse(t0) + 7 * 864e5).toISOString().slice(0, 10);
  const pass = (t: { title: string; tags: string[]; priority: number; due: string | null }) => (!q || t.title.toLowerCase().includes(q) || t.tags.some((g) => g.includes(q))) && (!sp.tag || t.tags.includes(sp.tag))
    && (!sp.priority || (sp.priority === "high" ? t.priority > 0 : sp.priority === "low" ? t.priority < 0 : t.priority === 0))
    && (!sp.due || (sp.due === "overdue" ? !!t.due && t.due < t0 : sp.due === "today" ? t.due === t0 : sp.due === "week" ? !!t.due && t.due >= t0 && t.due <= week : !t.due));
  const sorted = (list: typeof open) => sp.sort === "due" ? [...list].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")) : sp.sort === "priority" ? [...list].sort((a, b) => b.priority - a.priority) : sp.sort === "newest" ? [...list].sort((a, b) => b.id - a.id) : sp.sort === "oldest" ? [...list].sort((a, b) => a.id - b.id) : byPosition(list);
  const allTags = [...new Set([...open, ...allDone].flatMap((t) => t.tags))].sort();
  const cards = sorted([...open, ...done].filter(pass)), counts = Object.fromEntries(columns.map((c) => [c.key, queryTasks({ project: pid ?? undefined, state: "all", status: c.key, limit: 5000 }).length]));
  return (
    <>
      {lockProject === undefined && <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip href="/board" active={!project}>All projects</FilterChip>
        {projects.map((p) => <FilterChip key={p.id} href={`/board?project=${p.id}`} active={project === p.id} dot={p.color}>{p.name}{hasCustomColumns(p.id) ? <span className="text-dim">· own columns</span> : null}</FilterChip>)}
      </div>}
      {sp.columns && <Panel title={current ? `Columns for ${current.name}` : "Default columns"} i={0} className="mb-4 max-w-3xl"><ColumnsEditor projectId={pid} projectName={current?.name} columns={columns} custom={custom} counts={counts} /></Panel>}
      {lockProject === undefined && pid === null && own.length > 0 && <p className="mb-3 text-xs text-mute">These projects have their own columns, so they aren&apos;t shown here: {own.map((p, i) => <span key={p.id}>{i ? ", " : ""}<Link href={`/board?project=${p.id}`} className="text-accent hover:underline">{p.name}</Link></span>)}.</p>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2"><BoardFilters tags={allTags} /><DoneWindow days={days} showingAll={showAll} base={lockProject === undefined ? `/board${pid ? `?project=${pid}` : ""}` : base} /></div>
      <Board columns={columns} cards={cards} today={today()} projectId={pid} hiddenNote={hidden > 0 ? <p className="mt-2 px-2 text-xs text-dim">{hidden} older finished card{hidden === 1 ? "" : "s"} hidden. <Link className="text-accent hover:underline" href={lockProject === undefined ? `/board?${pid ? `project=${pid}&` : ""}done=all` : `${base}${base.includes("?") ? "&" : "?"}done=all`}>Show all</Link></p> : null} />
    </>
  );
}
