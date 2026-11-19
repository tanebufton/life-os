import { fmtMinutes } from "@/lib/dates";
import { Panel } from "./Panel";

export function OverviewCard({ done, focus, overdue, planned, capacity, i = 0 }: { done: number; focus?: number; overdue: number; planned: number; capacity: number; i?: number }) {
  const cell = (v: React.ReactNode, l: string, cls = "") => <div className="px-4 py-3.5"><div className={`text-[26px] font-semibold leading-none tracking-tight ${cls}`}>{v}</div><div className="mt-1.5 text-xs text-mute">{l}</div></div>;
  const ratio = capacity ? planned / capacity : 0, tone = ratio > 1.25 ? "bg-danger" : ratio > 1 ? "bg-warn" : "bg-ok";
  return (
    <Panel title="Today at a glance" i={i}>
      <div className={`grid divide-x ${focus === undefined ? "grid-cols-2" : "grid-cols-3"}`}>
        {cell(done, "Completed", done ? "text-ok" : "")}{focus !== undefined && cell(<>{focus}<span className="text-sm font-medium text-mute"> min</span></>, "Focused")}{cell(overdue, "Overdue", overdue ? "text-danger" : "")}
      </div>
      {planned > 0 && (
        <div className="border-t px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-mute">Planned workload</span><span className={ratio > 1 ? "font-medium text-warn" : "text-mute"}>{fmtMinutes(planned)} of {fmtMinutes(capacity)}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-raise"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
          {ratio > 1 && <p className="mt-1.5 text-xs text-warn">Over by {fmtMinutes(planned - capacity)}. Consider moving something.</p>}
        </div>
      )}
    </Panel>
  );
}
