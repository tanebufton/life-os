import Link from "next/link";
import { Board } from "@/components/board";
import { QuickAdd } from "@/components/tasks";
import { db, Project } from "@/lib/db";
import { queryTasks } from "@/lib/tasks";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const project = Number((await searchParams).project) || undefined;
  const projects = db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY name").all() as Project[];
  const open = queryTasks({ project });
  const done = queryTasks({ project, state: "done", limit: 12 });
  const chip = (active: boolean) => `rounded-full px-3 py-0.5 ${active ? "bg-indigo-600 text-white" : "bg-neutral-200 dark:bg-neutral-800"}`;
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Board</h1>
      <QuickAdd projectId={project} />
      <div className="mb-4 mt-3 flex flex-wrap gap-1.5 text-sm">
        <Link href="/board" className={chip(!project)}>all</Link>
        {projects.map((p) => <Link key={p.id} href={`/board?project=${p.id}`} className={chip(project === p.id)}>{p.name}</Link>)}
      </div>
      <Board cards={[...open, ...done]} today={today()} />
    </>
  );
}
