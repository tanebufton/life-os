import Link from "next/link";
import { BoardView, type BoardParams } from "@/components/boardview";
import { FeatureGate } from "@/components/FeatureGate";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/tasks";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function BoardPage({ searchParams }: { searchParams: Promise<BoardParams> }) {
  const sp = await searchParams, project = Number(sp.project) || undefined;
  const name = project ? (db.prepare("SELECT name FROM projects WHERE id=?").get(project) as { name: string } | undefined)?.name : undefined;
  return (
    <FeatureGate feature="board">
      <PageHead title={name ? `${name} board` : "Board"} sub="Drag cards between columns, or click one to open it" right={<Link href={`/board?${project ? `project=${project}&` : ""}columns=${sp.columns ? "" : "1"}`.replace(/[?&]$/, "")} className="btn"><Icon name="settings" size={14} />Columns</Link>} />
      <BoardView sp={sp} base="/board" />
    </FeatureGate>
  );
}
