import Link from "next/link";
import { notFound } from "next/navigation";
import { AddTaskRow } from "@/components/addrow";
import { BoardView, type BoardParams } from "@/components/boardview";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { ProjectAvatar } from "@/components/Pill";
import { ProjectEditor } from "@/components/projectedit";
import { TaskTable } from "@/components/tasktable";
import { TaskGroups, bucket } from "@/components/tasks";
import { VoiceRecorder } from "@/components/voice";
import { archiveProject } from "@/lib/actions";
import { addGoalAction, convertMemoAction, deleteMemoAction } from "@/lib/actions3";
import { newNoteInProjectAction } from "@/lib/actions5";
import { db, Project } from "@/lib/db";
import { isOn } from "@/lib/features";
import { goalProgress, listGoals } from "@/lib/goals";
import { listNotes } from "@/lib/notes";
import { hasCustomColumns } from "@/lib/statuses";
import { queryTasks } from "@/lib/tasks";
import { projectKey } from "@/lib/ui";
import { listMemos } from "@/lib/voice";

export const dynamic = "force-dynamic";
type SP = BoardParams & { tab?: string; dir?: string };

/** A project is its own workspace: overview, list, board, table, notes, voice memos and goals, all scoped to it. */
export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const id = Number((await params).id), sp = await searchParams;
  const p = db.prepare("SELECT * FROM projects WHERE id=?").get(id) as Project | undefined;
  if (!p) notFound();
  const open = queryTasks({ project: id }), doneCount = queryTasks({ project: id, state: "done", limit: 5000 }).length;
  const notes = isOn("notes") ? listNotes({ project: id }) : [], goals = isOn("goals") ? listGoals().filter((g) => g.project_id === id) : [], memos = isOn("voice") ? listMemos(60, id) : [];
  const tabs = [
    { k: "overview", label: "Overview", icon: "today" }, { k: "list", label: "List", icon: "list", n: open.length },
    ...(isOn("board") ? [{ k: "board", label: "Board", icon: "board" }] : []), { k: "table", label: "Table", icon: "grid" },
    ...(isOn("notes") ? [{ k: "notes", label: "Notes", icon: "notes", n: notes.length }] : []),
    ...(isOn("voice") ? [{ k: "memos", label: "Voice memos", icon: "mic", n: memos.length }] : []),
    ...(isOn("goals") ? [{ k: "goals", label: "Goals", icon: "goals", n: goals.length }] : []),
  ];
  const tab = tabs.some((t) => t.k === sp.tab) ? sp.tab! : sp.tab === "tasks" ? "list" : "overview";
  const base = `/projects/${id}`, href = (k: string, extra = "") => `${base}?tab=${k}${extra}`;
  const sort = sp.sort ?? "due", dir = sp.dir ?? "asc";
  const dueSoon = [...open].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")).slice(0, 6);
  return (
    <div className="proj">
      <div className="rise flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><ProjectAvatar name={p.name} color={p.color} size={36} />
          <div className="min-w-0"><h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">{p.name}</h1>
            <p className="text-[13px] text-mute">{projectKey(p.name)} · {open.length} open{hasCustomColumns(id) ? " · own board columns" : ""}</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><ProjectEditor id={id} name={p.name} color={p.color} /><form action={archiveProject.bind(null, id)}><button className="btn text-mute hover:!text-danger">Archive</button></form></div>
      </div>
      <div className="mb-5 mt-1 hidden md:block" />
      <nav aria-label="Project views" className="ptabs mb-6 flex gap-0.5 overflow-x-auto border-b md:hidden">
        {tabs.map((t) => { const on = t.k === tab; return (
          <Link key={t.k} href={t.k === "overview" ? base : href(t.k)} aria-current={on ? "page" : undefined} className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[14px] ${on ? "border-accent font-medium text-fg" : "border-transparent text-mute hover:text-fg"}`}>
            <Icon name={t.icon} size={15} className={on ? "text-accent" : ""} />{t.label}{t.n ? <span className="text-xs text-dim">{t.n}</span> : null}</Link>); })}
      </nav>

      {tab === "overview" && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Panel title="Up next" count={open.length} i={0} className="lg:col-span-2" right={<Link href={href("list")} className="text-xs text-accent hover:underline">All tasks</Link>}>
            <ul>{dueSoon.map((t) => <li key={t.id} className="border-b last:border-b-0"><Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-raise/50"><span className="truncate">{t.title}</span><span className="ml-auto shrink-0 text-xs text-mute">{t.due ?? ""}</span></Link></li>)}
              {!dueSoon.length && <li className="px-4 py-8 text-center text-sm text-mute">Nothing open. Add a task from the List tab.</li>}</ul>
          </Panel>
          <div className="space-y-4">
            <Panel title="Progress" i={1} bodyClass="p-4"><div className="flex items-baseline gap-4"><div><div className="text-2xl font-semibold tabular-nums">{open.length}</div><div className="text-xs text-mute">open</div></div><div><div className="text-2xl font-semibold tabular-nums">{doneCount}</div><div className="text-xs text-mute">done</div></div></div></Panel>
            {isOn("notes") && <Panel title="Notes" count={notes.length} i={2} right={<Link href={href("notes")} className="text-xs text-accent hover:underline">Open</Link>}><ul>{notes.slice(0, 4).map((n) => <li key={n.id} className="border-b last:border-b-0"><Link href={`/notes/${n.id}`} className="block truncate px-4 py-2 text-[14px] hover:bg-raise/50">{n.title || "Untitled"}</Link></li>)}{!notes.length && <li className="px-4 py-4 text-sm text-mute">No notes yet.</li>}</ul></Panel>}
            {isOn("voice") && <Panel title="Voice memos" count={memos.length} i={3} right={<Link href={href("memos")} className="text-xs text-accent hover:underline">Open</Link>}><ul>{memos.slice(0, 3).map((m) => <li key={m.id} className="border-b px-4 py-2 text-[13px] last:border-b-0"><span className="line-clamp-2">{m.text}</span></li>)}{!memos.length && <li className="px-4 py-4 text-sm text-mute">No memos yet.</li>}</ul></Panel>}
          </div>
        </div>
      )}
      {tab === "list" && <div className="max-w-4xl"><TaskGroups groups={bucket(open)} empty="No open tasks here yet. New tasks you add from this page land in this project." /><AddTaskRow /></div>}
      {tab === "board" && <BoardView sp={sp} lockProject={id} base={href("board")} />}
      {tab === "table" && <TaskTable rows={open} sort={sort} dir={dir} base={(o) => href("table", Object.entries(o).filter(([, v]) => v).map(([k, v]) => `&${k}=${encodeURIComponent(v as string)}`).join(""))} />}
      {tab === "notes" && (
        <div className="max-w-4xl"><Panel i={0} right={<form action={newNoteInProjectAction.bind(null, id)}><button className="font-medium text-accent hover:underline">New note</button></form>}>
          <ul>{notes.map((n) => <li key={n.id} className="border-b last:border-b-0"><Link href={`/notes/${n.id}`} className="flex items-center gap-2 px-4 py-2.5 text-[14px] hover:bg-raise/50"><Icon name="notes" size={15} className="text-mute" /><span className="truncate">{n.title || "Untitled"}</span><span className="ml-auto text-xs text-dim">{n.updated_at.slice(0, 10)}</span></Link></li>)}
            {!notes.length && <li className="px-4 py-10 text-center text-sm text-mute">No notes in this project yet.</li>}</ul></Panel></div>
      )}
      {tab === "memos" && (
        <div className="max-w-4xl space-y-4"><Panel title="Record" i={0}><VoiceRecorder projectId={id} /></Panel>
          <Panel title="Memos" count={memos.length} i={1}><ul>{memos.map((m) => (
            <li key={m.id} className="border-b px-4 py-3 last:border-b-0"><p className="whitespace-pre-wrap text-[14px] leading-relaxed">{m.text}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute"><span>{m.created_at.slice(0, 16).replace("T", " ")}</span>
                {m.task_id ? <Link href={`/tasks/${m.task_id}`} className="text-accent hover:underline">Task #{m.task_id}</Link> : <form action={convertMemoAction.bind(null, m.id, "task")}><button className="hover:text-fg">Make task</button></form>}
                {m.note_id ? <Link href={`/notes/${m.note_id}`} className="text-accent hover:underline">Note</Link> : <form action={convertMemoAction.bind(null, m.id, "note")}><button className="hover:text-fg">Make note</button></form>}
                <form action={deleteMemoAction.bind(null, m.id)} className="ml-auto"><button className="text-dim hover:text-danger">Delete</button></form></div></li>))}
            {!memos.length && <li className="px-4 py-10 text-center text-sm text-mute">No memos in this project yet. Anything you record here is filed under it.</li>}</ul></Panel></div>
      )}
      {tab === "goals" && (
        <div className="max-w-4xl space-y-3">{goals.map((g) => { const pr = goalProgress(g).pct; return <Panel key={g.id} i={0} bodyClass="p-4"><div className="flex items-baseline justify-between gap-3"><Link href="/goals" className="font-semibold hover:underline">{g.title}</Link><span className="tabular-nums text-mute">{pr}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full bg-accent" style={{ width: `${pr}%` }} /></div></Panel>; })}
          <form action={addGoalAction} className="flex gap-2"><input type="hidden" name="project_id" value={id} /><input name="title" required placeholder="New goal for this project" aria-label="New goal" className="field" /><button className="btn">Add goal</button></form></div>
      )}
    </div>
  );
}
