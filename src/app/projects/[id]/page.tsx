import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveProject } from "@/lib/actions";
import { db, Project } from "@/lib/db";
import { QuickAdd, QuickAddHint, TaskList } from "@/components/tasks";
import { card } from "@/components/ui";
import { queryTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const p = db.prepare("SELECT * FROM projects WHERE id=?").get(id) as Project | undefined;
  if (!p) notFound();
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: p.color }}>{p.name}</h1>
        <div className="flex gap-4 text-sm"><Link href={`/board?project=${id}`} className="text-indigo-600 dark:text-indigo-400">Board</Link>
          <form action={archiveProject.bind(null, id)}><button className="text-neutral-500 hover:text-red-500">Archive</button></form></div>
      </div>
      <QuickAdd projectId={id} /><QuickAddHint />
      <div className={card}><TaskList tasks={queryTasks({ project: id })} empty="No open tasks in this project." /></div>
    </>
  );
}
