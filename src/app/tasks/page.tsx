import Link from "next/link";
import { AddTaskRow } from "@/components/addrow";
import { FlashToast } from "@/components/flash";
import { FilterChip } from "@/components/chip";
import { hue } from "@/lib/ui";
import { PageHead, TaskGroups, bucket } from "@/components/tasks";
import { listTags, queryTasks } from "@/lib/tasks";
import { BulkList } from "@/components/bulk";
import { TaskTable } from "@/components/tasktable";

export const dynamic = "force-dynamic";
export default async function All({ searchParams }: { searchParams: Promise<{ tag?: string; done?: string; deleted?: string; select?: string; view?: string; sort?: string; dir?: string }> }) {
  const { tag, done, deleted, select, view, sort = "due", dir = "asc" } = await searchParams;
  const tags = listTags();
  const open = queryTasks({ tag });
  const finished = done ? queryTasks({ tag, state: "done", limit: 60 }) : [];
  const table = view === "table";
  const q = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString(); return `/tasks${p ? "?" + p : ""}`; };
  return (
    <div className="max-w-4xl">
      <FlashToast deleted={Number(deleted) || undefined} base="/tasks" />
      <PageHead title={tag ? `#${tag}` : "My tasks"} sub={`${open.length} open`} right={<><div className="inline-flex rounded-md border p-0.5 text-xs" role="group" aria-label="View"><Link href={q({ tag, done })} className={`rounded px-2.5 py-1 ${!table ? "bg-raise font-medium" : "text-mute"}`}>List</Link><Link href={q({ tag, done, view: "table" })} className={`rounded px-2.5 py-1 ${table ? "bg-raise font-medium" : "text-mute"}`}>Table</Link></div>{!table && <Link href={q({ tag, done, select: "1" })} className="btn">Select</Link>}<Link href={q({ tag, done: done ? undefined : "1" })} className="btn">{done ? "Hide completed" : "Show completed"}</Link></>} />
      {tags.length > 0 && (
        <div className="rise mb-5 flex flex-wrap items-center gap-1.5" style={{ ["--i" as string]: 1 }}>
          <FilterChip href={q({ done })} active={!tag}>All</FilterChip>
          {tags.map((g) => <FilterChip key={g.name} href={q({ tag: g.name, done })} active={tag === g.name} dot={`rgb(${hue(g.name)})`}>#{g.name}<span className="text-dim">{g.open}</span></FilterChip>)}
        </div>
      )}
      {table ? <TaskTable rows={[...open, ...finished]} sort={sort} dir={dir} base={(o) => q({ tag, done, view: "table", ...o })} /> : select ? <BulkList rows={open.map((x) => ({ id: x.id, title: x.title, due: x.due, project: x.project_name }))} exit={q({ tag, done })} /> : <><TaskGroups groups={bucket(open)} empty="No open tasks. Add one with the + button." />
      <AddTaskRow /></>}
      {done && <div className="mt-8"><TaskGroups groups={[{ label: "Completed", tasks: finished }]} empty="Nothing completed yet." /></div>}
    </div>
  );
}
