import Link from "next/link";
import { Board } from "@/components/board";
import { ProjectAvatar } from "@/components/Pill";
import { PageHead } from "@/components/tasks";
import { db, Project } from "@/lib/db";
import { queryTasks } from "@/lib/tasks";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const project = Number((await searchParams).project) || undefined;
  const projects = db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY name").all() as Project[];
  const cards = [...queryTasks({ project }), ...queryTasks({ project, state: "done", limit: 12 })];
  const chip = (on: boolean) => `inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition ${on ? "border-accent/40 bg-accent/10 text-accent" : "text-mute hover:bg-raise"}`;
  return (
    <>
      <PageHead title="Board" sub="Drag cards between columns, or use the arrows" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/board" className={chip(!project)}>All projects</Link>
        {projects.map((p) => <Link key={p.id} href={`/board?project=${p.id}`} className={chip(project === p.id)}><ProjectAvatar name={p.name} color={p.color} size={16} />{p.name}</Link>)}
      </div>
      <Board cards={cards} today={today()} />
    </>
  );
}
