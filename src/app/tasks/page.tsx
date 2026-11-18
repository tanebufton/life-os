import Link from "next/link";
import { QuickAdd, QuickAddHint, TaskList } from "@/components/tasks";
import { card } from "@/components/ui";
import { listTags, queryTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export default async function All({ searchParams }: { searchParams: Promise<{ tag?: string; done?: string }> }) {
  const { tag, done } = await searchParams;
  const tags = listTags();
  const open = queryTasks({ tag });
  const finished = done ? queryTasks({ tag, state: "done", limit: 50 }) : [];
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">{tag ? `#${tag}` : "All tasks"}</h1>
      <QuickAdd /><QuickAddHint />
      {tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
          <Link href="/tasks" className={`rounded-full px-3 py-0.5 ${!tag ? "bg-indigo-600 text-white" : "bg-neutral-200 dark:bg-neutral-800"}`}>all</Link>
          {tags.map((g) => <Link key={g.name} href={`/tasks?tag=${encodeURIComponent(g.name)}`} className={`rounded-full px-3 py-0.5 ${tag === g.name ? "bg-indigo-600 text-white" : "bg-neutral-200 dark:bg-neutral-800"}`}>#{g.name} <span className="opacity-60">{g.open}</span></Link>)}
        </div>
      )}
      <div className={card}><TaskList tasks={open} empty="No open tasks." /></div>
      <p className="mt-4 text-sm">{done ? <Link className="text-indigo-600 dark:text-indigo-400" href={tag ? `/tasks?tag=${tag}` : "/tasks"}>Hide completed</Link> : <Link className="text-indigo-600 dark:text-indigo-400" href={`/tasks?${tag ? `tag=${encodeURIComponent(tag)}&` : ""}done=1`}>Show recently completed</Link>}</p>
      {done && <div className={`${card} mt-3`}><TaskList tasks={finished} empty="Nothing completed yet." /></div>}
    </>
  );
}
