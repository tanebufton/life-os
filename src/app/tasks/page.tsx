import Link from "next/link";
import { AddTaskRow } from "@/components/addrow";
import { FlashToast } from "@/components/flash";
import { Pill } from "@/components/Pill";
import { PageHead, TaskGroups, bucket } from "@/components/tasks";
import { listTags, queryTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export default async function All({ searchParams }: { searchParams: Promise<{ tag?: string; done?: string; deleted?: string }> }) {
  const { tag, done, deleted } = await searchParams;
  const tags = listTags();
  const open = queryTasks({ tag });
  const finished = done ? queryTasks({ tag, state: "done", limit: 60 }) : [];
  const q = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString(); return `/tasks${p ? "?" + p : ""}`; };
  const chip = (on: boolean) => `inline-flex h-7 items-center rounded-full border px-3 text-[13px] font-medium transition ${on ? "border-accent/40 bg-accent/10 text-accent" : "text-mute hover:bg-raise"}`;
  return (
    <div className="mx-auto max-w-3xl">
      <FlashToast deleted={Number(deleted) || undefined} base="/tasks" />
      <PageHead title={tag ? `#${tag}` : "My tasks"} sub={`${open.length} open`} right={<Link href={q({ tag, done: done ? undefined : "1" })} className="btn">{done ? "Hide completed" : "Show completed"}</Link>} />
      {tags.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <Link href={q({ done })} className={chip(!tag)}>All</Link>
          {tags.map((g) => <Link key={g.name} href={q({ tag: g.name, done })} className={`rounded-md ${tag === g.name ? "ring-2 ring-accent/60 ring-offset-2 ring-offset-bg" : ""}`}><Pill name={g.name} /></Link>)}
        </div>
      )}
      <TaskGroups groups={bucket(open)} empty="No open tasks. Add one with the + button." />
      <AddTaskRow />
      {done && <div className="mt-8"><TaskGroups groups={[{ label: "Completed", tasks: finished }]} empty="Nothing completed yet." /></div>}
    </div>
  );
}
