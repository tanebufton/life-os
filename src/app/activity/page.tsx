import Link from "next/link";
import { FilterChip } from "@/components/chip";
import { fmtAt } from "@/components/history";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { describeEvent, recentActivity, type Entity } from "@/lib/activity";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const KINDS: { key: Entity | "all"; label: string }[] = [{ key: "all", label: "Everything" }, { key: "task", label: "Tasks" }, { key: "note", label: "Notes" }, { key: "goal", label: "Goals" }];
export default async function Activity({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const k = (await searchParams).kind, kind = (["task", "note", "goal"].includes(k ?? "") ? k : undefined) as Entity | undefined, events = recentActivity(150, kind);
  const title = (e: { entity: string; entity_id: number }) => (e.entity === "task" ? (db.prepare("SELECT title FROM tasks WHERE id=?").get(e.entity_id) as { title: string } | undefined)?.title : e.entity === "note" ? (db.prepare("SELECT title FROM notes WHERE id=?").get(e.entity_id) as { title: string } | undefined)?.title : (db.prepare("SELECT title FROM goals WHERE id=?").get(e.entity_id) as { title: string } | undefined)?.title) ?? "(deleted)";
  const href = (e: { entity: string; entity_id: number }) => (e.entity === "task" ? `/tasks/${e.entity_id}` : e.entity === "note" ? `/notes/${e.entity_id}` : "/goals");
  return (
    <div className="max-w-4xl">
      <PageHead title="Activity" sub="Everything that changed, newest first. Each task, note and goal also has its own History." />
      <div className="mb-4 flex flex-wrap gap-1.5">{KINDS.map((x) => <FilterChip key={x.key} href={x.key === "all" ? "/activity" : `/activity?kind=${x.key}`} active={(kind ?? "all") === x.key}>{x.label}</FilterChip>)}</div>
      <Panel i={0}><ul>{events.map((e) => (
        <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b px-4 py-2.5 text-[13px] last:border-b-0"><span className="w-28 shrink-0 text-xs text-dim">{fmtAt(e.at)}</span>
          <Link href={href(e)} className="min-w-0 max-w-[16rem] truncate font-medium hover:underline">{title(e)}</Link><span className="text-mute">{describeEvent(e)}</span>{e.actor !== "you" && <span className="lozenge bg-raise text-mute">{e.actor.startsWith("api:") ? `API · ${e.actor.slice(4)}` : e.actor}</span>}</li>))}
        {!events.length && <li className="px-4 py-12 text-center text-sm text-mute">Nothing yet. Changes you make from now on are recorded here.</li>}</ul></Panel>
    </div>
  );
}
