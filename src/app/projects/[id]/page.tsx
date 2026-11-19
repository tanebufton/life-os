import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddTaskRow } from "@/components/addrow";
import { BoardView, type BoardParams } from "@/components/boardview";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { ProjectAvatar } from "@/components/Pill";
import { ProjectEditor } from "@/components/projectedit";
import { TaskTable } from "@/components/tasktable";
import { TaskGroups, TaskRow, bucket } from "@/components/tasks";
import { ReorderList } from "@/components/reorder";
import { addGoalAction } from "@/lib/actions3";
import { newNoteInProjectAction } from "@/lib/actions5";
import { db, Project } from "@/lib/db";
import { isOn } from "@/lib/features";
import { goalProgress, listGoals } from "@/lib/goals";
import { listNotes, noteTree } from "@/lib/notes";
import { FavouriteButton } from "@/components/favbutton";
import { isFavourite } from "@/lib/favourites";
import { hasCustomColumns } from "@/lib/statuses";
import { queryTasks } from "@/lib/tasks";
import { projectKey } from "@/lib/ui";

export const dynamic = "force-dynamic";
type SP = BoardParams & { tab?: string; dir?: string };

/** A project is its own workspace: overview, list, board, table, notes, voice memos and goals, all scoped to it. */
export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const id = Number((await params).id), sp = await searchParams;
  const p = db.prepare("SELECT * FROM projects WHERE id=?").get(id) as Project | undefined;
  if (!p) notFound();
  const open = queryTasks({ project: id }), doneCount = queryTasks({ project: id, state: "done", limit: 5000 }).length;
  const notes = isOn("notes") ? listNotes({ project: id }) : [], goals = isOn("goals") ? listGoals().filter((g) => g.project_id === id) : [];
  const tabs = [
    { k: "overview", label: "Overview", icon: "today" }, { k: "list", label: "List", icon: "list", n: open.length },
    ...(isOn("board") ? [{ k: "board", label: "Board", icon: "board" }] : []), { k: "table", label: "Table", icon: "grid" },
    ...(isOn("notes") ? [{ k: "notes", label: "Notes", icon: "notes", n: notes.length }] : []),
        ...(isOn("goals") ? [{ k: "goals", label: "Goals", icon: "goals", n: goals.length }] : []),
  ];
  // No view in the address: open to the project's chosen view (if it's still available), else the overview.
  if (!sp.tab && p.default_view && tabs.some((t) => t.k === p.default_view)) redirect(`/projects/${id}?tab=${p.default_view}`);
  const tab = tabs.some((t) => t.k === sp.tab) ? sp.tab! : sp.tab === "tasks" ? "list" : "overview";
  const base = `/projects/${id}`, href = (k: string, extra = "") => `${base}?tab=${k}${extra}`;
  const sort = sp.sort ?? "due", dir = sp.dir ?? "asc";
  // Dated tasks first (soonest first), then undated ones with the newest on top, so something you just added is always in view.
  const ordered = [...open].sort((a, b) => (a.due && b.due ? a.due.localeCompare(b.due) : a.due ? -1 : b.due ? 1 : b.id - a.id)), dueSoon = ordered.slice(0, 10), moreOpen = ordered.length - dueSoon.length;
  return (
    <div className="proj">
      <div className="rise flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><ProjectAvatar name={p.name} color={p.color} size={36} icon={p.icon} />
          <div className="min-w-0"><h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">{p.name}</h1>
            <p className="text-[13px] text-mute">{p.area ? `${p.area} · ` : ""}{projectKey(p.name)} · {open.length} open{hasCustomColumns(id) ? " · own board columns" : ""}</p></div></div>
        <div className="flex items-center gap-2"><FavouriteButton kind="project" id={id} on={isFavourite("project", id)} /><ProjectEditor id={id} name={p.name} color={p.color} icon={p.icon} area={p.area} view={p.default_view} views={tabs.map((t) => ({ k: t.k, label: t.label }))} areas={(db.prepare("SELECT DISTINCT area FROM projects WHERE area!='' ORDER BY area").all() as { area: string }[]).map((r) => r.area)} /></div>
      </div>
      <div className="mb-6 hidden md:block" />
      <nav aria-label="Project views" className="ptabs mb-6 flex gap-0.5 overflow-x-auto border-b md:hidden">
        {tabs.map((t) => { const on = t.k === tab; return (
          <Link key={t.k} href={href(t.k)} aria-current={on ? "page" : undefined} className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[14px] ${on ? "border-accent font-medium text-fg" : "border-transparent text-mute hover:text-fg"}`}>
            <Icon name={t.icon} size={15} className={on ? "text-accent" : ""} />{t.label}{t.n ? <span className="text-xs text-dim">{t.n}</span> : null}</Link>); })}
      </nav>

      {tab === "overview" && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Panel title="Up next" count={open.length} i={0} className="lg:col-span-2" right={<Link href={href("list")} className="text-xs text-accent hover:underline">All tasks</Link>}>
            <div className="px-2"><ReorderList>{dueSoon.map((t) => <TaskRow key={t.id} t={t} />)}</ReorderList>
              {!dueSoon.length && <p className="px-2 py-6 text-center text-sm text-mute">Nothing open yet. Add the first task below.</p>}<AddTaskRow />{moreOpen > 0 && <Link href={href("list")} className="block px-2 pb-2 pt-1 text-xs text-accent hover:underline">+{moreOpen} more in List</Link>}</div>
          </Panel>
          <div className="space-y-4">
            <Panel title="Progress" i={1} bodyClass="p-4"><div className="flex items-baseline gap-4"><div><div className="text-2xl font-semibold tabular-nums">{open.length}</div><div className="text-xs text-mute">open</div></div><div><div className="text-2xl font-semibold tabular-nums">{doneCount}</div><div className="text-xs text-mute">done</div></div></div></Panel>
            {isOn("notes") && <Panel title="Notes" count={notes.length} i={2} right={<Link href={href("notes")} className="text-xs text-accent hover:underline">Open</Link>}><ul>{notes.slice(0, 4).map((n) => <li key={n.id} className="border-b last:border-b-0"><Link href={`/notes/${n.id}`} className="block truncate px-4 py-2 text-[14px] hover:bg-raise/50">{n.title || "Untitled"}</Link></li>)}{!notes.length && <li className="px-4 py-4 text-sm text-mute">No notes yet.</li>}</ul></Panel>}
          </div>
        </div>
      )}
      {tab === "list" && <div><TaskGroups groups={bucket(open)} empty="No open tasks here yet. New tasks you add from this page land in this project." /><AddTaskRow /></div>}
      {tab === "board" && <BoardView sp={sp} lockProject={id} base={href("board")} />}
      {tab === "table" && <TaskTable hideProject rows={open} sort={sort} dir={dir} base={(o) => href("table", Object.entries(o).filter(([, v]) => v).map(([k, v]) => `&${k}=${encodeURIComponent(v as string)}`).join(""))} />}
      {tab === "table" && <div className="mt-2"><AddTaskRow /></div>}
      {tab === "notes" && (
        <div><div className="mb-3 flex justify-end"><form action={newNoteInProjectAction.bind(null, id)}><button className="btn-primary"><Icon name="plus" size={14} />New note</button></form></div><Panel i={0}>
          <ul>{noteTree(notes).map((n) => <li key={n.id} className="border-b last:border-b-0"><Link href={`/notes/${n.id}`} style={{ paddingLeft: 16 + n.depth * 22 }} className="flex items-center gap-2 py-2.5 pr-4 text-[14px] hover:bg-raise/50">{n.icon ? <span aria-hidden>{n.icon}</span> : <Icon name="notes" size={15} className="text-mute" />}<span className="truncate">{n.title || "Untitled"}</span><span className="ml-auto text-xs text-dim">{n.updated_at.slice(0, 10)}</span></Link></li>)}
            {!notes.length && <li className="px-4 py-10 text-center text-sm text-mute">No notes in this project yet.</li>}</ul></Panel></div>
      )}
      {tab === "goals" && (
        <div className="space-y-3">{goals.map((g) => { const pr = goalProgress(g).pct; return <Panel key={g.id} i={0} bodyClass="p-4"><div className="flex items-baseline justify-between gap-3"><Link href="/goals" className="font-semibold hover:underline">{g.title}</Link><span className="tabular-nums text-mute">{pr}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full bg-accent" style={{ width: `${pr}%` }} /></div></Panel>; })}
          <form action={addGoalAction} className="flex gap-2"><input type="hidden" name="project_id" value={id} /><input name="title" required placeholder="New goal for this project" aria-label="New goal" className="field" /><button className="btn">Add goal</button></form></div>
      )}
    </div>
  );
}
