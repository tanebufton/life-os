import { db, Project, Task } from "@/lib/db";
import { addTask, deleteTask, toggleTask } from "@/lib/actions";

export function TaskForm({ projectId }: { projectId?: number }) {
  const projects = db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY name").all() as Project[];
  return (
    <form action={addTask} className="mb-6 flex flex-wrap gap-2">
      <input name="title" placeholder="Add a task…" required className="min-w-0 flex-1 rounded border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" />
      {projectId ? <input type="hidden" name="project_id" value={projectId} /> : (
        <select name="project_id" className="rounded border px-2 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <input type="date" name="due" className="rounded border px-2 dark:border-neutral-700 dark:bg-neutral-900" />
      <select name="priority" className="rounded border px-2 dark:border-neutral-700 dark:bg-neutral-900">
        <option value="0">Normal</option><option value="1">High</option><option value="-1">Low</option>
      </select>
      <button className="rounded bg-indigo-600 px-4 py-2 text-white">Add</button>
    </form>
  );
}

export function TaskList({ tasks }: { tasks: (Task & { project_name?: string | null })[] }) {
  if (!tasks.length) return <p className="text-neutral-500">Nothing here.</p>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ul className="divide-y dark:divide-neutral-800">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-3 py-2">
          <form action={toggleTask.bind(null, t.id)}>
            <button aria-label="Toggle done" className={`h-5 w-5 rounded-full border-2 ${t.done_at ? "border-indigo-600 bg-indigo-600" : "border-neutral-400"}`} />
          </form>
          <div className="min-w-0 flex-1">
            <div className={t.done_at ? "text-neutral-400 line-through" : ""}>
              {t.priority > 0 && <span className="mr-1 text-red-500">!</span>}{t.title}
            </div>
            <div className="text-xs text-neutral-500">
              {t.project_name}{t.project_name && t.due ? " · " : ""}
              {t.due && <span className={!t.done_at && t.due < today ? "text-red-500" : ""}>{t.due}</span>}
            </div>
          </div>
          <form action={deleteTask.bind(null, t.id)}><button aria-label="Delete" className="text-neutral-400 hover:text-red-500">×</button></form>
        </li>
      ))}
    </ul>
  );
}

const SELECT = `SELECT t.*, p.name AS project_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id`;
const ORDER = `ORDER BY t.done_at IS NOT NULL, t.priority DESC, t.due IS NULL, t.due, t.id`;
export const queryTasks = (where = "1=1", ...args: unknown[]) =>
  db.prepare(`${SELECT} WHERE ${where} ${ORDER}`).all(...args) as (Task & { project_name: string | null })[];
