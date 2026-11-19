import Link from "next/link";
import { Board } from "@/components/board";
import { FilterChip } from "@/components/chip";
import { ColumnsEditor, DoneWindow } from "@/components/columns";
import { getSetting } from "@/lib/settings";
import { FeatureGate } from "@/components/FeatureGate";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { db, Project } from "@/lib/db";
import { hasCustomColumns, listStatuses } from "@/lib/statuses";
import { queryTasks } from "@/lib/tasks";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ project?: string; columns?: string; done?: string }> }) {
  const sp = await searchParams, project = Number(sp.project) || undefined;
  const projects = db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY name").all() as Project[];
  const current = project ? projects.find((p) => p.id === project) : undefined, pid = current ? current.id : null;
  const columns = listStatuses(pid), custom = hasCustomColumns(pid);
  // "All projects" shows the default columns. Projects with their own columns have their own board, linked below.
  const own = projects.filter((p) => hasCustomColumns(p.id));
  const keep = (t: { project_id: number | null }) => (pid !== null ? true : !t.project_id || !own.some((p) => p.id === t.project_id));
  const days = Number(getSetting("board_done_days") ?? 7), showAll = sp.done === "all", cutoff = days > 0 && !showAll ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19).replace("T", " ") : "";
  const open = queryTasks({ project: pid ?? undefined }).filter(keep);
  const allDone = queryTasks({ project: pid ?? undefined, state: "done", limit: 400 }).filter(keep), done = allDone.filter((t) => !cutoff || (t.done_at ?? "") >= cutoff).slice(0, showAll || !days ? 200 : 150), hidden = allDone.length - done.length;
  const cards = [...open, ...done], counts = Object.fromEntries(columns.map((c) => [c.key, queryTasks({ project: pid ?? undefined, state: "all", status: c.key, limit: 5000 }).length]));
  return (
    <FeatureGate feature="board">
      <PageHead title={current ? `${current.name} board` : "Board"} sub="Drag cards between columns, or click one to open it" right={<Link href={`/board?${pid ? `project=${pid}&` : ""}columns=${sp.columns ? "" : "1"}`.replace(/[?&]$/, "")} className="btn"><Icon name="settings" size={14} />Columns</Link>} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip href="/board" active={!project}>All projects</FilterChip>
        {projects.map((p) => <FilterChip key={p.id} href={`/board?project=${p.id}`} active={project === p.id} dot={p.color}>{p.name}{hasCustomColumns(p.id) ? <span className="text-dim">· own columns</span> : null}</FilterChip>)}
      </div>
      {sp.columns && <Panel title={current ? `Columns for ${current.name}` : "Default columns"} i={0} className="mb-4 max-w-3xl"><ColumnsEditor projectId={pid} projectName={current?.name} columns={columns} custom={custom} counts={counts} /></Panel>}
      {pid === null && own.length > 0 && <p className="mb-3 text-xs text-mute">These projects have their own columns, so they aren&apos;t shown here: {own.map((p, i) => <span key={p.id}>{i ? ", " : ""}<Link href={`/board?project=${p.id}`} className="text-accent hover:underline">{p.name}</Link></span>)}.</p>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><DoneWindow days={days} showingAll={showAll} base={`/board${pid ? `?project=${pid}` : ""}`} /></div>
      <Board columns={columns} cards={cards} today={today()} projectId={pid} hiddenNote={hidden > 0 ? <p className="mt-2 px-2 text-xs text-dim">{hidden} older finished card{hidden === 1 ? "" : "s"} hidden. <Link className="text-accent hover:underline" href={`/board?${pid ? `project=${pid}&` : ""}done=all`}>Show all</Link></p> : null} />
    </FeatureGate>
  );
}
