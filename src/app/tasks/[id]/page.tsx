import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SubtaskList, TaskEditor } from "@/components/editor";
import { StatusIcon } from "@/components/StatusIcon";
import { db, Project } from "@/lib/db";
import { isOn } from "@/lib/features";
import { describeRepeat, getTask, subtasks } from "@/lib/tasks";
import { issueKey } from "@/lib/ui";
import { addCommentAction, deleteCommentAction, saveTemplateFromTask } from "@/lib/actions3";
import { listComments } from "@/lib/misc";
import { nice } from "@/lib/dates";
import { listStatuses } from "@/lib/statuses";
import { History } from "@/components/history";
import { LinksPanel } from "@/components/links";
import { listLinks } from "@/lib/links";
import { FavouriteButton } from "@/components/favbutton";
import { isFavourite } from "@/lib/favourites";

export const dynamic = "force-dynamic";
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const t = getTask(Number((await params).id));
  if (!t) notFound();
  const projects = db.prepare("SELECT id, name FROM projects WHERE archived=0 ORDER BY name").all() as Pick<Project, "id" | "name">[];
  const kids = t.parent_id ? [] : subtasks(t.id).map((s) => ({ id: s.id, title: s.title, done: !!s.done_at }));
  const parent = t.parent_id ? getTask(t.parent_id) : null;
  const meta = t.meta ? (JSON.parse(t.meta) as { from?: string; subject?: string }) : null;
  const comments = listComments(t.id);
  const columns = Object.fromEntries([["0", listStatuses(null)], ...projects.map((p) => [String(p.id), listStatuses(p.id)])].map(([k, v]) => [k, (v as ReturnType<typeof listStatuses>).map((c) => ({ key: c.key, name: c.name, kind: c.kind }))]));
  return (
    <div className="max-w-[1100px]">
      <div className="rise">
        <TaskEditor focus={isOn("focus")} projects={projects} columns={columns} head={<>
        <div className="mb-1 flex items-center gap-2 text-xs text-mute">
          {parent && <><Link href={`/tasks/${parent.id}`} className="inline-flex max-w-[16rem] items-center gap-1 truncate hover:text-fg"><Icon name="chevRight" size={12} className="rotate-180" />{parent.title}</Link><span aria-hidden>/</span></>}
          <StatusIcon status={t.status_kind} size={15} /><span className="font-medium">{issueKey(t.project_name, t.id)}</span>
          <span>{t.status_name}</span>{t.done_at && <span className="lozenge bg-ok/15 text-ok">Done</span>}
          {t.source === "email" && <span className="inline-flex items-center gap-1"><Icon name="mail" size={12} />Imported from email</span>}
          {t.source === "share" && <span className="inline-flex items-center gap-1"><Icon name="share" size={12} />Shared to LifeOS</span>}
          <span className="ml-1"><FavouriteButton kind="task" id={t.id} on={isFavourite("task", t.id)} /></span>
        </div>
        {meta?.from && <p className="mb-2 text-xs text-mute">From {meta.from}{meta.subject ? <> · “{meta.subject}”</> : null}</p>}
        </>} task={{ id: t.id, title: t.title, notes: t.notes, status: t.status, priority: t.priority, project_id: t.project_id, due: t.due, due_time: t.due_time, estimate: t.estimate, repeat: t.repeat ? describeRepeat(t.repeat) : "", tags: t.tags.join(" ") }}>
          {!t.parent_id && <SubtaskList parentId={t.id} items={kids} />}
          <LinksPanel kind="task" id={t.id} links={listLinks("task", t.id)} />
        </TaskEditor>
      </div>
      <section className="rise mt-8 max-w-3xl" style={{ ["--i" as string]: 2 }}>
        <h2 className="mb-2 text-[13px] font-semibold">Activity <span className="font-normal text-dim">{comments.length || ""}</span></h2>
        <ul className="space-y-2">{comments.map((c) => <li key={c.id} className="group rounded-lg border bg-panel px-3 py-2 text-[14px]"><p className="whitespace-pre-wrap">{c.body}</p><div className="mt-1 flex items-center justify-between text-xs text-dim"><span>{nice(c.created_at.slice(0, 10))} {c.created_at.slice(11, 16)}</span><form action={deleteCommentAction.bind(null, t.id, c.id)}><button className="opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100">Delete</button></form></div></li>)}</ul>
        <form action={addCommentAction.bind(null, t.id)} className="mt-2 flex gap-2"><input name="body" required placeholder="Add a comment or progress note…" aria-label="Comment" className="field" /><button className="btn">Post</button></form>
        <History entity="task" id={t.id} />
        {isOn("templates") && !t.parent_id && <form action={saveTemplateFromTask.bind(null, t.id)} className="mt-4"><button className="text-xs text-mute hover:text-fg">Save as template</button></form>}
      </section>
    </div>
  );
}
