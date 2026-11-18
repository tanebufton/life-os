import Link from "next/link";
import { quickAdd, toggleTask } from "@/lib/actions";
import { describeRepeat, type TaskRow } from "@/lib/tasks";
import { addDays, nice, today } from "@/lib/time";
import { input, btn } from "./ui";

export function QuickAdd({ projectId, autoFocus }: { projectId?: number; autoFocus?: boolean }) {
  return (
    <form action={quickAdd} className="mb-1 flex gap-2">
      {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
      <input name="text" required autoFocus={autoFocus} autoComplete="off" enterKeyHint="done"
        placeholder="Add a task…  e.g. Pay rent every month #bills !high tomorrow"
        className={`${input} min-w-0 flex-1`} />
      <button className={btn}>Add</button>
    </form>
  );
}
export const QuickAddHint = () => (
  <p className="mb-5 text-xs text-neutral-500">
    <code>#tag</code> <code>@project</code> <code>!high</code> <code>!low</code> <code>!doing</code> · <code>today</code> <code>tomorrow</code> <code>friday</code> <code>in 3 days</code> <code>2026-12-01</code> · <code>daily</code> <code>weekdays</code> <code>every 2 weeks</code>
  </p>
);

function dueLabel(due: string, done: boolean) {
  const t = today();
  if (due === t) return <span className="text-amber-600 dark:text-amber-400">today</span>;
  if (due === addDays(t, 1)) return <span>tomorrow</span>;
  return <span className={!done && due < t ? "text-red-500" : ""}>{nice(due)}</span>;
}

export function TaskList({ tasks, empty = "Nothing here." }: { tasks: TaskRow[]; empty?: string }) {
  if (!tasks.length) return <p className="py-2 text-sm text-neutral-500">{empty}</p>;
  return (
    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-3 py-2.5">
          <form action={toggleTask.bind(null, t.id)} className="pt-0.5">
            <button aria-label={t.done_at ? "Reopen" : "Complete"}
              className={`h-6 w-6 rounded-full border-2 ${t.done_at ? "border-indigo-600 bg-indigo-600" : t.priority > 0 ? "border-red-400" : "border-neutral-400"}`} />
          </form>
          <div className="min-w-0 flex-1">
            <Link href={`/tasks/${t.id}`} className={`block break-words ${t.done_at ? "text-neutral-400 line-through" : ""}`}>
              {t.status === "doing" && <span className="mr-1.5 rounded bg-indigo-100 px-1.5 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">doing</span>}
              {t.title}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
              {t.project_name && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: t.project_color ?? "#999" }} />{t.project_name}</span>}
              {t.due && dueLabel(t.due, !!t.done_at)}
              {t.repeat && <span title="Repeats">↻ {describeRepeat(t.repeat)}</span>}
              {t.tags.map((g) => <Link key={g} href={`/tasks?tag=${encodeURIComponent(g)}`} className="text-indigo-600 hover:underline dark:text-indigo-400">#{g}</Link>)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
