import { BoardView, type BoardParams } from "@/components/boardview";
import { FeatureGate } from "@/components/FeatureGate";
import { PageHead } from "@/components/tasks";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function BoardPage({ searchParams }: { searchParams: Promise<BoardParams> }) {
  const sp = await searchParams, project = Number(sp.project) || undefined;
  const name = project ? (db.prepare("SELECT name FROM projects WHERE id=?").get(project) as { name: string } | undefined)?.name : undefined;
  return (
    <FeatureGate feature="board">
      <div className="hidden md:block"><PageHead title={name ? `${name} board` : "Board"} sub="Drag cards between columns, or click one to open it" /></div>
      <BoardView sp={sp} base="/board" />
    </FeatureGate>
  );
}
