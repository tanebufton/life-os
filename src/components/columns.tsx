"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { addColumnAction, deleteColumnAction, moveColumnAction, renameColumnAction, saveBoardDoneDays, setColumnKindAction, useOwnColumnsAction } from "@/lib/actions5";
import { Icon } from "./Icon";
import type { Column } from "./board";

type R = { ok: boolean; message?: string; error?: string };
const KIND = { todo: "To do", doing: "In progress", done: "Done" } as const;
/** Edit the board's columns. For a project, first choose between the default columns and its own. */
export function ColumnsEditor({ projectId, projectName, columns, custom, counts }: { projectId: number | null; projectName?: string; columns: Column[]; custom: boolean; counts: Record<string, number> }) {
  const [busy, start] = useTransition(), [name, setName] = useState(""), [kind, setKind] = useState<Column["kind"]>("todo"), [removing, setRemoving] = useState<number | null>(null), [target, setTarget] = useState<number | undefined>(undefined);
  const run = (f: () => Promise<R>, then?: () => void) => start(async () => { const r = await f(); if (!r.ok) toast(r.error ?? "That didn't work"); else { if (r.message) toast(r.message); then?.(); } });
  const [own, setOwn] = useState(custom); useEffect(() => setOwn(custom), [custom]);
  const editable = projectId === null || custom;
  return (
    <div className="space-y-3 p-4">
      {projectId !== null && (
        <label className="flex items-start gap-2.5 text-[13px]"><input type="checkbox" className="mt-0.5" checked={own} disabled={busy} onChange={(e) => { const on = e.target.checked; if (!on && !confirm(`Go back to the default columns for ${projectName ?? "this project"}? Its tasks move to the matching default column.`)) return; setOwn(on); start(async () => { const r = await useOwnColumnsAction(projectId, on); if (!r.ok) { setOwn(!on); toast(r.error); } else if (r.message) toast(r.message); }); }} />
          <span><b>Use their own columns for {projectName ?? "this project"}</b><span className="block text-xs text-mute">{custom ? "These columns apply to this project only." : "Currently using the default columns shared by your other projects."}</span></span></label>
      )}
      {editable ? <>
        <ul className="divide-y rounded-lg border">{columns.map((c, i) => (
          <li key={c.id} className="space-y-2 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <input defaultValue={c.name} aria-label={`Name of column ${c.name}`} className="field !w-auto min-w-32 flex-1 !py-1" maxLength={30} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) run(() => renameColumnAction(c.id, v)); else e.target.value = c.name; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <select value={c.kind} disabled={busy} aria-label={`Kind of ${c.name}`} onChange={(e) => run(() => setColumnKindAction(c.id, e.target.value as Column["kind"]))} className="field !w-36 !py-1">{(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}</select>
              <button className="grid h-7 w-7 place-items-center rounded text-mute hover:bg-raise disabled:opacity-30" disabled={busy || i === 0} aria-label={`Move ${c.name} left`} onClick={() => run(() => moveColumnAction(c.id, -1))}><Icon name="chevRight" size={15} className="rotate-180" /></button>
              <button className="grid h-7 w-7 place-items-center rounded text-mute hover:bg-raise disabled:opacity-30" disabled={busy || i === columns.length - 1} aria-label={`Move ${c.name} right`} onClick={() => run(() => moveColumnAction(c.id, 1))}><Icon name="chevRight" size={15} /></button>
              <button className="grid h-7 w-7 place-items-center rounded text-mute hover:bg-raise hover:text-danger disabled:opacity-30" disabled={busy || columns.length <= 2} aria-label={`Delete ${c.name}`} onClick={() => { setRemoving(c.id); setTarget(columns.find((x) => x.id !== c.id && x.kind === c.kind)?.id ?? columns.find((x) => x.id !== c.id)?.id); }}><Icon name="trash" size={15} /></button>
            </div>
            {removing === c.id && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-danger/5 px-2 py-1.5 text-[13px]">
                <span>{counts[c.key] ? `${counts[c.key]} task${counts[c.key] === 1 ? "" : "s"} will move to` : "Delete this column?"}</span>
                {!!counts[c.key] && <select value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Move tasks to" className="field !w-auto !py-1">{columns.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
                <button className="btn !h-7 text-danger" disabled={busy} onClick={() => run(() => deleteColumnAction(c.id, target), () => setRemoving(null))}>Delete</button><button className="text-xs text-mute underline" onClick={() => setRemoving(null)}>Cancel</button>
              </div>)}
          </li>))}
        </ul>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addColumnAction(projectId, name, kind), () => setName("")); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New column, e.g. In review" aria-label="New column name" maxLength={30} className="field !w-auto min-w-48 flex-1" />
          <select value={kind} onChange={(e) => setKind(e.target.value as Column["kind"])} aria-label="New column kind" className="field !w-36">{(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}</select>
          <button className="btn-primary" disabled={busy || !name.trim()}>Add column</button>
        </form>
        <p className="text-xs text-dim">The kind tells LifeOS what a column means: <b>To do</b> is waiting, <b>In progress</b> counts as being worked on (Today, reminders, focus), <b>Done</b> completes the task. You need at least one To do and one Done.</p>
      </> : null}
    </div>
  );
}

/** How long finished cards stay on the board. */
export function DoneWindow({ days, showingAll, base }: { days: number; showingAll: boolean; base: string }) {
  const [, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-mute">Hide finished cards after
      <select value={days} aria-label="Hide finished cards after" className="field !w-auto !py-1" onChange={(e) => start(async () => { const r = await saveBoardDoneDays(Number(e.target.value)); if (!r.ok) toast(r.error); })}>
        <option value={0}>Never</option><option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>
      {days > 0 && <a href={showingAll ? base : `${base}${base.includes("?") ? "&" : "?"}done=all`} className="text-accent hover:underline">{showingAll ? "Back to recent" : "Show all"}</a>}
    </label>
  );
}
