import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { PageHead } from "@/components/tasks";
import { matrix } from "@/lib/misc";
import { queryTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export default function Matrix() {
  const m = matrix(queryTasks({ limit: 300 } as never).filter((x) => !x.parent_id));
  const Q = ({ title, sub, rows, tone }: { title: string; sub: string; rows: ReturnType<typeof queryTasks>; tone: string }) => (
    <section className="card rise flex min-h-48 flex-col overflow-hidden"><header className={`border-b px-4 py-2.5 ${tone}`}><h2 className="text-[13px] font-semibold">{title} <span className="font-normal text-mute">{rows.length}</span></h2><p className="text-xs text-mute">{sub}</p></header>
      <ul className="flex-1 overflow-y-auto">{rows.slice(0, 12).map((x) => <li key={x.id} className="border-b last:border-b-0"><Link href={`/tasks/${x.id}`} className="block truncate px-4 py-2 text-[13.5px] hover:bg-raise/50">{x.title}</Link></li>)}{!rows.length && <li className="px-4 py-6 text-center text-xs text-dim">Empty</li>}{rows.length > 12 && <li className="px-4 py-2 text-xs text-dim">+{rows.length - 12} more</li>}</ul></section>);
  return (
    <FeatureGate feature="board">
      <PageHead title="Priority matrix" sub="Urgent means due within 2 days. Important means high priority." />
      <div className="grid gap-4 sm:grid-cols-2"><Q title="Do now" sub="Urgent and important" rows={m.doNow} tone="bg-danger/10" /><Q title="Schedule" sub="Important, not urgent" rows={m.schedule} tone="bg-accent/10" /><Q title="Quick wins" sub="Urgent, not important" rows={m.delegate} tone="bg-warn/10" /><Q title="Someday" sub="Neither" rows={m.drop} tone="bg-raise" /></div>
    </FeatureGate>
  );
}
