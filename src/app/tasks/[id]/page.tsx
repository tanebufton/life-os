import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { StatusIcon } from "@/components/StatusIcon";
import { deleteTask, saveTask } from "@/lib/actions";
import { db, Project } from "@/lib/db";
import { describeRepeat, getTask } from "@/lib/tasks";
import { issueKey } from "@/lib/ui";

export const dynamic = "force-dynamic";
const Prop = ({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2 py-0.5 sm:grid-cols-[150px_minmax(0,1fr)]">
    <span className="flex items-center gap-2 px-1 text-[13px] text-mute"><Icon name={icon} size={15} />{label}</span>{children}</div>
);

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const t = getTask(Number((await params).id));
  if (!t) notFound();
  const projects = db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY name").all() as Project[];
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/tasks" className="mb-5 inline-flex items-center gap-1 text-[13px] text-mute hover:text-fg"><Icon name="chevRight" size={14} className="rotate-180" />My tasks</Link>
      <form action={saveTask.bind(null, t.id)} className="rise">
        <div className="mb-2 flex items-center gap-2 text-xs text-mute">
          <StatusIcon status={t.status} size={15} />
          <span className="font-medium">{issueKey(t.project_name, t.id)}</span>
          {t.done_at && <span className="lozenge bg-ok/15 text-ok">Done</span>}
        </div>
        <input name="title" defaultValue={t.title} required aria-label="Title" className="mb-5 w-full rounded-md bg-transparent px-1 py-1 text-[30px] font-bold leading-tight tracking-tight outline-none hover:bg-raise/60 focus:bg-raise/60" />
        <div className="space-y-0.5 border-y py-3">
          <Prop icon="circleCheck" label="Status"><select name="status" defaultValue={t.status} className="ghost"><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select></Prop>
          <Prop icon="chevUp2" label="Priority"><select name="priority" defaultValue={t.priority} className="ghost"><option value="1">High</option><option value="0">Normal</option><option value="-1">Low</option></select></Prop>
          <Prop icon="list" label="Project"><select name="project_id" defaultValue={t.project_id ?? ""} className="ghost"><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Prop>
          <Prop icon="calendar" label="Due date"><input type="date" name="due" defaultValue={t.due ?? ""} className="ghost" /></Prop>
          <Prop icon="repeat" label="Repeat"><input name="repeat" defaultValue={t.repeat ? describeRepeat(t.repeat) : ""} placeholder="Doesn't repeat (try: weekly, every 2 weeks)" className="ghost" /></Prop>
          <Prop icon="inbox" label="Tags"><input name="tags" defaultValue={t.tags.join(" ")} placeholder="Add tags, separated by spaces" className="ghost" /></Prop>
        </div>
        <textarea name="notes" defaultValue={t.notes} rows={8} placeholder="Add notes…" className="ghost mt-4 min-h-40 resize-y !px-1 !py-2 text-[15px] leading-relaxed" />
        <div className="mt-4 flex items-center gap-2"><button className="btn-primary">Save changes</button><Link href="/tasks" className="btn">Cancel</Link></div>
      </form>
      <form action={deleteTask.bind(null, t.id)} className="mt-10 border-t pt-4"><button className="text-[13px] text-mute hover:text-danger">Delete this task</button></form>
    </div>
  );
}
