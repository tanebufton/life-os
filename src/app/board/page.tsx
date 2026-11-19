import { Board } from "@/components/board";
import { FilterChip } from "@/components/chip";
import { FeatureGate } from "@/components/FeatureGate";
import { PageHead } from "@/components/tasks";
import { db, Project } from "@/lib/db";
import { queryTasks } from "@/lib/tasks";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const project = Number((await searchParams).project) || undefined;
  const projects = db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY name").all() as Project[];
  const cards = [...queryTasks({ project }), ...queryTasks({ project, state: "done", limit: 8 })];
  return (
    <FeatureGate feature="board">
      <PageHead title="Board" sub="Drag cards between columns, or use the arrows" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip href="/board" active={!project}>All projects</FilterChip>
        {projects.map((p) => <FilterChip key={p.id} href={`/board?project=${p.id}`} active={project === p.id} dot={p.color}>{p.name}</FilterChip>)}
      </div>
      <Board cards={cards} today={today()} />
    </FeatureGate>
  );
}
