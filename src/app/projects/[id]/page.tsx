import { notFound } from "next/navigation";
import { db, Project } from "@/lib/db";
import { archiveProject } from "@/lib/actions";
import { TaskForm, TaskList, queryTasks } from "@/components";
export const dynamic = "force-dynamic";
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const p = db.prepare("SELECT * FROM projects WHERE id=?").get(id) as Project | undefined;
  if (!p) notFound();
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: p.color }}>{p.name}</h1>
        <form action={archiveProject.bind(null, id)}><button className="text-sm text-neutral-500 hover:text-red-500">Archive</button></form>
      </div>
      <TaskForm projectId={id} />
      <TaskList tasks={queryTasks("t.project_id = ?", id)} />
    </>
  );
}
