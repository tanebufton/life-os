"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteRuleAction, saveRuleAction } from "@/lib/actions5";
import { Icon } from "./Icon";

type Col = { key: string; name: string; kind: string };
type R = { id: number; offset_days: number; column_key: string; to_top: number; set_priority: number | null; enabled: number };
/** "On the due date, move the card to Today, at the top." Saves as you change it. */
export function AutomationsEditor({ projectId, columns, rules }: { projectId: number | null; columns: Col[]; rules: R[] }) {
  const router = useRouter(), [, start] = useTransition(), [busy, setBusy] = useState(false);
  const targets = columns.filter((c) => c.kind !== "done");
  const save = (r: Partial<R> & { id?: number }, base?: R) => start(async () => {
    setBusy(true);
    const m = { offset_days: base?.offset_days ?? 0, column_key: base?.column_key ?? (targets.find((c) => /^today$/i.test(c.name)) ?? targets.find((c) => c.kind === "doing") ?? targets[0])?.key ?? "", to_top: (base?.to_top ?? 1) === 1, set_priority: base?.set_priority ?? null, enabled: (base?.enabled ?? 1) === 1 };
    const next = { ...m, ...("offset_days" in r ? { offset_days: r.offset_days! } : {}), ...("column_key" in r ? { column_key: r.column_key! } : {}), ...("to_top" in r ? { to_top: r.to_top === 1 } : {}), ...("set_priority" in r ? { set_priority: r.set_priority ?? null } : {}), ...("enabled" in r ? { enabled: r.enabled === 1 } : {}) };
    const res = await saveRuleAction({ id: r.id, project_id: projectId, ...next }); setBusy(false);
    toast(res.ok ? (res.message ?? "Saved") : res.error); router.refresh();
  });
  const sel = "field !w-auto !py-1 text-[13px]";
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-mute">Rules run by themselves (every half minute while LifeOS or its worker is running). Each card is moved once per due date, so if you put it back by hand it stays where you put it. Cards already overdue when you add a rule are left alone.</p>
      {rules.map((r) => (
        <div key={r.id} className={`flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border px-3 py-2.5 text-[13px] ${r.enabled ? "" : "opacity-60"}`}>
          <select aria-label="When" value={r.offset_days} onChange={(e) => save({ id: r.id, offset_days: Number(e.target.value) }, r)} className={sel}><option value={0}>On the due date</option>{[1, 2, 3, 7].map((n) => <option key={n} value={n}>{n} day{n === 1 ? "" : "s"} before the due date</option>)}</select>
          <span className="text-mute">move the card to</span>
          <select aria-label="Column" value={r.column_key} onChange={(e) => save({ id: r.id, column_key: e.target.value }, r)} className={sel}>{targets.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={r.to_top === 1} onChange={(e) => save({ id: r.id, to_top: e.target.checked ? 1 : 0 }, r)} />at the top</label>
          <span className="text-mute">and priority</span>
          <select aria-label="Priority" value={r.set_priority ?? ""} onChange={(e) => save({ id: r.id, set_priority: e.target.value === "" ? null : Number(e.target.value) }, r)} className={sel}><option value="">unchanged</option><option value={1}>High</option><option value={0}>Normal</option><option value={-1}>Low</option></select>
          <span className="ml-auto flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-mute"><input type="checkbox" checked={r.enabled === 1} onChange={(e) => save({ id: r.id, enabled: e.target.checked ? 1 : 0 }, r)} />On</label>
            <button aria-label="Delete automation" title="Delete" onClick={() => start(async () => { const res = await deleteRuleAction(r.id); toast(res.ok ? "Automation removed" : res.error); router.refresh(); })} className="grid h-7 w-7 place-items-center rounded-md text-mute hover:bg-raise hover:text-danger"><Icon name="trash" size={14} /></button>
          </span>
        </div>))}
      {!rules.length && <p className="rounded-lg border border-dashed px-3 py-5 text-center text-[13px] text-mute">No automations yet. Try: on the due date, move the card to Today.</p>}
      <button className="btn" disabled={busy || !targets.length} onClick={() => save({})}><Icon name="plus" size={14} />Add automation</button>
    </div>
  );
}
