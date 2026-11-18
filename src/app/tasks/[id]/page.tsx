import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteTask, saveTask } from "@/lib/actions";
import { db, Project } from "@/lib/db";
import { describeRepeat, getTask } from "@/lib/tasks";
import { btn, btn2, card, input } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const t = getTask(Number((await params).id));
  if (!t) notFound();
  const projects = db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY name").all() as Project[];
  const L = ({ children }: { children: React.ReactNode }) => <label className="flex flex-col gap-1 text-sm text-neutral-500">{children}</label>;
  return (
    <div className="max-w-xl">
      <Link href="/tasks" className="text-sm text-indigo-600 dark:text-indigo-400">← Tasks</Link>
      <form action={saveTask.bind(null, t.id)} className={`${card} mt-3 flex flex-col gap-3`}>
        <input name="title" defaultValue={t.title} required className={`${input} text-lg`} aria-label="Title" />
        <textarea name="notes" defaultValue={t.notes} rows={5} placeholder="Notes" className={input} />
        <div className="grid grid-cols-2 gap-3">
          <L>Status<select name="status" defaultValue={t.status} className={input}><option value="todo">To do</option><option value="doing">Doing</option><option value="done">Done</option></select></L>
          <L>Priority<select name="priority" defaultValue={t.priority} className={input}><option value="1">High</option><option value="0">Normal</option><option value="-1">Low</option></select></L>
          <L>Project<select name="project_id" defaultValue={t.project_id ?? ""} className={input}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></L>
          <L>Due<input type="date" name="due" defaultValue={t.due ?? ""} className={input} /></L>
          <L>Repeat<input name="repeat" defaultValue={t.repeat ? describeRepeat(t.repeat) : ""} placeholder="daily, weekdays, every 2 weeks…" className={input} /></L>
          <L>Tags<input name="tags" defaultValue={t.tags.join(" ")} placeholder="space separated" className={input} /></L>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button className={btn}>Save</button>
          <span className="text-xs text-neutral-500">created {t.done_at ? `· done ${t.done_at}` : ""}</span>
        </div>
      </form>
      <form action={deleteTask.bind(null, t.id)} className="mt-4"><button className={`${btn2} text-red-600`}>Delete task</button></form>
    </div>
  );
}
