"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteRuleAction, saveRuleAction } from "@/lib/actions5";
import { Icon } from "./Icon";

type Col = { key: string; name: string; kind: string };
type R = { id: number; kind: string; offset_days: number; column_key: string; when_column: string; to_top: number; set_priority: number | null; add_tag: string; set_due: string; enabled: number };
const sel = "field !w-auto !py-1 text-[13px]";
/** "When ___, then ___". Each rule saves as you change it. */
export function AutomationsEditor({ projectId, columns, rules }: { projectId: number | null; columns: Col[]; rules: R[] }) {
  const router = useRouter(), [, start] = useTransition(), [busy, setBusy] = useState(false), [tagDraft, setTagDraft] = useState<Record<number, string>>({});
  const targets = columns.filter((c) => c.kind !== "done");
  const persist = (r: R) => start(async () => {
    setBusy(true);
    const res = await saveRuleAction({ id: r.id || undefined, project_id: projectId, kind: r.kind, offset_days: r.offset_days, column_key: r.column_key, when_column: r.when_column, to_top: r.to_top === 1, set_priority: r.set_priority, add_tag: r.add_tag, set_due: r.set_due, enabled: r.enabled === 1 });
    setBusy(false); toast(res.ok ? (res.message ?? "Saved") : res.error); router.refresh();
  });
  const add = () => { const today = targets.find((c) => /^today$/i.test(c.name)) ?? targets.find((c) => c.kind === "doing") ?? targets[0]; persist({ id: 0, kind: "due", offset_days: 0, column_key: today?.key ?? "", when_column: "", to_top: 1, set_priority: null, add_tag: "", set_due: "", enabled: 1 }); };
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-mute">Rules run by themselves (every half minute while LifeOS or its worker is running). Each card is handled once per occasion, so if you put it back by hand it stays where you put it. Cards already overdue when you add a date rule are left alone.</p>
      {rules.map((r) => { const ch = (p: Partial<R>) => persist({ ...r, ...p }); return (
        <div key={r.id} className={`space-y-2 rounded-lg border px-3 py-2.5 text-[13px] ${r.enabled ? "" : "opacity-60"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-11 font-medium text-mute">When</span>
            <select aria-label="Trigger" value={r.kind} onChange={(e) => ch({ kind: e.target.value, when_column: e.target.value === "due" ? "" : r.when_column || (targets[0]?.key ?? ""), offset_days: e.target.value === "stale" ? 3 : 0 })} className={sel}>
              <option value="due">the due date arrives</option><option value="enter">a card is moved to a column</option><option value="stale">a card has sat in a column for a while</option><option value="created">a card is created</option></select>
            {r.kind === "due" && <select aria-label="Days before" value={r.offset_days} onChange={(e) => ch({ offset_days: Number(e.target.value) })} className={sel}><option value={0}>on the day</option>{[1, 2, 3, 7].map((n) => <option key={n} value={n}>{n} day{n === 1 ? "" : "s"} before</option>)}</select>}
            {(r.kind === "enter" || r.kind === "stale") && <select aria-label="Watch column" value={r.when_column} onChange={(e) => ch({ when_column: e.target.value })} className={sel}>{targets.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>}
            {r.kind === "stale" && <><span className="text-mute">for</span><select aria-label="Days" value={r.offset_days} onChange={(e) => ch({ offset_days: Number(e.target.value) })} className={sel}>{[1, 2, 3, 5, 7, 14, 30].map((n) => <option key={n} value={n}>{n} day{n === 1 ? "" : "s"}</option>)}</select></>}
            {r.kind === "created" && <select aria-label="In column" value={r.when_column} onChange={(e) => ch({ when_column: e.target.value })} className={sel}><option value="">in any column</option>{targets.map((c) => <option key={c.key} value={c.key}>in {c.name}</option>)}</select>}
            <span className="ml-auto flex items-center gap-2"><label className="inline-flex items-center gap-1.5 text-mute"><input type="checkbox" checked={r.enabled === 1} onChange={(e) => ch({ enabled: e.target.checked ? 1 : 0 })} />On</label>
              <button aria-label="Delete automation" title="Delete" onClick={() => start(async () => { const res = await deleteRuleAction(r.id); toast(res.ok ? "Automation removed" : res.error); router.refresh(); })} className="grid h-7 w-7 place-items-center rounded-md text-mute hover:bg-raise hover:text-danger"><Icon name="trash" size={14} /></button></span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-11 font-medium text-mute">Then</span>
            <select aria-label="Move to" value={r.column_key} onChange={(e) => ch({ column_key: e.target.value })} className={sel}><option value="">don&apos;t move it</option>{targets.map((c) => <option key={c.key} value={c.key}>move to {c.name}</option>)}</select>
            {r.column_key && <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={r.to_top === 1} onChange={(e) => ch({ to_top: e.target.checked ? 1 : 0 })} />at the top</label>}
            <select aria-label="Priority" value={r.set_priority ?? ""} onChange={(e) => ch({ set_priority: e.target.value === "" ? null : Number(e.target.value) })} className={sel}><option value="">keep priority</option><option value={1}>set High</option><option value={0}>set Normal</option><option value={-1}>set Low</option></select>
            <select aria-label="Set due date" value={r.set_due} onChange={(e) => ch({ set_due: e.target.value })} className={sel}><option value="">keep due date</option><option value="today">due today</option><option value="tomorrow">due tomorrow</option><option value="week">due in a week</option><option value="clear">clear the due date</option></select>
            <input aria-label="Add tag" placeholder="add tag…" value={tagDraft[r.id] ?? r.add_tag} onChange={(e) => setTagDraft((d) => ({ ...d, [r.id]: e.target.value }))} onBlur={() => { const v = (tagDraft[r.id] ?? r.add_tag).trim(); if (v !== r.add_tag) ch({ add_tag: v }); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className="field !w-32 !py-1 text-[13px]" />
          </div>
        </div>); })}
      {!rules.length && <p className="rounded-lg border border-dashed px-3 py-5 text-center text-[13px] text-mute">No automations yet. Try: when the due date arrives, move the card to Today. Or: when a card has sat in Waiting for 7 days, add the tag “chase”.</p>}
      <button className="btn" disabled={busy || !targets.length} onClick={add}><Icon name="plus" size={14} />Add automation</button>
    </div>
  );
}
