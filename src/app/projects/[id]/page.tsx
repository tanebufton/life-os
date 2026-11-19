import Link from "next/link";
import { notFound } from "next/navigation";
import { AddTaskRow } from "@/components/addrow";
import { ProjectAvatar } from "@/components/Pill";
import { PageHead, TaskGroups, bucket } from "@/components/tasks";
import { archiveProject } from "@/lib/actions";
import { db, Project } from "@/lib/db";
import { queryTasks } from "@/lib/tasks";
import { projectKey } from "@/lib/ui";

export const dynamic = "force-dynamic";
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const p = db.prepare("SELECT * FROM projects WHERE id=?").get(id) as Project | undefined;
  if (!p) notFound();
  const open = queryTasks({ project: id });
  return (
    <div className="max-w-4xl">
      <PageHead title={p.name} icon={<ProjectAvatar name={p.name} color={p.color} size={40} />} sub={`${projectKey(p.name)} · ${open.length} open`}
        right={<><Link href={`/board?project=${id}`} className="btn">Open board</Link><form action={archiveProject.bind(null, id)}><button className="btn text-mute hover:!text-danger">Archive</button></form></>} />
      <TaskGroups groups={bucket(open)} empty="No open tasks here yet. New tasks you add from this page land in this project." />
      <AddTaskRow />
    </div>
  );
}
