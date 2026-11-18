import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SubtaskList, TaskEditor } from "@/components/editor";
import { StatusIcon } from "@/components/StatusIcon";
import { db, Project } from "@/lib/db";
import { isOn } from "@/lib/features";
import { describeRepeat, getTask, subtasks } from "@/lib/tasks";
import { issueKey } from "@/lib/ui";

export const dynamic = "force-dynamic";
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const t = getTask(Number((await params).id));
  if (!t) notFound();
  const projects = db.prepare("SELECT id, name FROM projects WHERE archived=0 ORDER BY name").all() as Pick<Project, "id" | "name">[];
  const kids = t.parent_id ? [] : subtasks(t.id).map((s) => ({ id: s.id, title: s.title, done: !!s.done_at }));
  const parent = t.parent_id ? getTask(t.parent_id) : null;
  const meta = t.meta ? (JSON.parse(t.meta) as { from?: string; subject?: string }) : null;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={parent ? `/tasks/${parent.id}` : "/tasks"} className="mb-5 inline-flex items-center gap-1 text-[13px] text-mute hover:text-fg"><Icon name="chevRight" size={14} className="rotate-180" />{parent ? parent.title : "My tasks"}</Link>
      <div className="rise">
        <div className="mb-1 flex items-center gap-2 text-xs text-mute">
          <StatusIcon status={t.status} size={15} /><span className="font-medium">{issueKey(t.project_name, t.id)}</span>
          {t.done_at && <span className="lozenge bg-ok/15 text-ok">Done</span>}
          {t.source === "email" && <span className="inline-flex items-center gap-1"><Icon name="mail" size={12} />Imported from email</span>}
          {t.source === "share" && <span className="inline-flex items-center gap-1"><Icon name="share" size={12} />Shared to LifeOS</span>}
        </div>
        {meta?.from && <p className="mb-2 text-xs text-mute">From {meta.from}{meta.subject ? <> · “{meta.subject}”</> : null}</p>}
        <TaskEditor focus={isOn("focus")} projects={projects} task={{ id: t.id, title: t.title, notes: t.notes, status: t.status, priority: t.priority, project_id: t.project_id, due: t.due, due_time: t.due_time, estimate: t.estimate, repeat: t.repeat ? describeRepeat(t.repeat) : "", tags: t.tags.join(" ") }}>
          {!t.parent_id && <SubtaskList parentId={t.id} items={kids} />}
        </TaskEditor>
      </div>
    </div>
  );
}
