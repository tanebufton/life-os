import { AddTaskRow } from "@/components/addrow";
import { Icon } from "@/components/Icon";
import { PageHead, TaskGroups } from "@/components/tasks";
import { searchTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
const OPS = [["#tag", "has the tag"], ["@project", "in a project"], ["due:today", "today, tomorrow, week, overdue, none, or a date"], ["is:done", "done, any, doing, recurring, overdue"], ["!high", "high priority (!low too)"], ["no:date", "no date, project or tag"], ["has:subtasks", "notes, link, time, estimate"], ["source:email", "api, share, manual"]];
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const results = q ? searchTasks(q, 100) : [];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHead title="Search" sub={q ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Find anything with plain words or filters"} />
      <form className="mb-6"><div className="flex items-center gap-2.5 rounded-xl border bg-panel px-3.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25"><Icon name="search" size={17} className="text-mute" />
        <input name="q" defaultValue={q} autoFocus placeholder="e.g. invoice #bills due:week" className="w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-dim" /></div></form>
      {q ? <><TaskGroups groups={[{ label: "Results", tasks: results }]} empty={<>No tasks match “{q}”. Add <code className="rounded bg-raise px-1">is:any</code> to include completed ones.</>} /><AddTaskRow /></> : (
        <dl className="grid gap-x-6 gap-y-2.5 rounded-xl border p-4 text-[13px] sm:grid-cols-[auto_1fr]">{OPS.map(([k, d]) => <div key={k} className="contents"><dt className="font-medium text-accent">{k}</dt><dd className="text-mute">{d}</dd></div>)}</dl>)}
    </div>
  );
}
