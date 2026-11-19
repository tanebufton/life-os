import Link from "next/link";
import { notFound } from "next/navigation";
import { AddTaskRow } from "@/components/addrow";
import { FilterChip } from "@/components/chip";
import { ProjectEditor } from "@/components/projectedit";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { ProjectAvatar } from "@/components/Pill";
import { PageHead, TaskGroups, bucket } from "@/components/tasks";
import { archiveProject } from "@/lib/actions";
import { addGoalAction } from "@/lib/actions3";
import { newNoteInProjectAction } from "@/lib/actions5";
import { db, Project } from "@/lib/db";
import { isOn } from "@/lib/features";
import { goalProgress, listGoals } from "@/lib/goals";
import { listNotes } from "@/lib/notes";
import { hasCustomColumns } from "@/lib/statuses";
import { queryTasks } from "@/lib/tasks";
import { projectKey } from "@/lib/ui";

export const dynamic = "force-dynamic";
/** A project is a hub: its tasks, its board, and the notes and goals linked to it. Everything is still in the global lists too. */
export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const id = Number((await params).id), tab = (await searchParams).tab ?? "tasks";
  const p = db.prepare("SELECT * FROM projects WHERE id=?").get(id) as Project | undefined;
  if (!p) notFound();
  const open = queryTasks({ project: id }), notes = isOn("notes") ? listNotes({ project: id }) : [], goals = isOn("goals") ? listGoals().filter((g) => g.project_id === id) : [];
  const tabs = [{ k: "tasks", label: "Tasks", n: open.length }, ...(isOn("notes") ? [{ k: "notes", label: "Notes", n: notes.length }] : []), ...(isOn("goals") ? [{ k: "goals", label: "Goals", n: goals.length }] : [])];
  return (
    <div className="max-w-4xl">
      <PageHead title={p.name} icon={<ProjectAvatar name={p.name} color={p.color} size={40} />} sub={`${projectKey(p.name)} · ${open.length} open${hasCustomColumns(id) ? " · own board columns" : ""}`}
        right={<>{isOn("board") && <Link href={`/board?project=${id}`} className="btn">Open board</Link>}<form action={archiveProject.bind(null, id)}><button className="btn text-mute hover:!text-danger">Archive</button></form></>} />
      <ProjectEditor id={id} name={p.name} color={p.color} />
      <div className="mb-5 flex flex-wrap gap-1.5">{tabs.map((t) => <FilterChip key={t.k} href={t.k === "tasks" ? `/projects/${id}` : `/projects/${id}?tab=${t.k}`} active={tab === t.k || (t.k === "tasks" && !tabs.some((x) => x.k === tab))}>{t.label}<span className="text-dim">{t.n}</span></FilterChip>)}</div>
      {tab === "notes" && isOn("notes") ? (
        <Panel i={0} right={<form action={newNoteInProjectAction.bind(null, id)}><button className="font-medium text-accent hover:underline">New note</button></form>}>
          <ul>{notes.map((n) => <li key={n.id} className="border-b last:border-b-0"><Link href={`/notes/${n.id}`} className="flex items-center gap-2 px-4 py-2.5 text-[14px] hover:bg-raise/50"><Icon name="notes" size={15} className="text-mute" /><span className="truncate">{n.title || "Untitled"}</span><span className="ml-auto text-xs text-dim">{n.updated_at.slice(0, 10)}</span></Link></li>)}
            {!notes.length && <li className="px-4 py-10 text-center text-sm text-mute">No notes in this project yet.</li>}</ul></Panel>
      ) : tab === "goals" && isOn("goals") ? (
        <div className="space-y-3">{goals.map((g) => { const pr = goalProgress(g).pct; return <Panel key={g.id} i={0} bodyClass="p-4"><div className="flex items-baseline justify-between gap-3"><Link href="/goals" className="font-semibold hover:underline">{g.title}</Link><span className="tabular-nums text-mute">{pr}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full bg-accent" style={{ width: `${pr}%` }} /></div></Panel>; })}
          <form action={addGoalAction} className="flex gap-2"><input type="hidden" name="project_id" value={id} /><input name="title" required placeholder="New goal for this project" aria-label="New goal" className="field" /><button className="btn">Add goal</button></form></div>
      ) : (<><TaskGroups groups={bucket(open)} empty="No open tasks here yet. New tasks you add from this page land in this project." /><AddTaskRow /></>)}
    </div>
  );
}
