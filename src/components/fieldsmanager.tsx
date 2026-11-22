"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFieldAction, moveFieldAction, saveFieldAction } from "@/lib/actions5";
import { Icon } from "./Icon";

type F = { id: number; project_id: number | null; name: string; type: string; options: string[]; show_on_card: boolean };
const TYPES: [string, string][] = [["text", "Text"], ["number", "Number"], ["select", "Choice"], ["date", "Date"], ["checkbox", "Checkbox"], ["url", "Link"]];
/** Your own task properties. A field applies to every task, or to just one project. */
export function FieldsManager({ fields, projects }: { fields: F[]; projects: { id: number; name: string }[] }) {
  const router = useRouter(), [, start] = useTransition(), [name, setName] = useState(""), [type, setType] = useState("text"), [options, setOptions] = useState(""), [scope, setScope] = useState(""), [card, setCard] = useState(false);
  const go = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, done?: () => void) => start(async () => { const r = await fn(); if (!r.ok) toast(r.error ?? "Couldn't do that"); else { done?.(); router.refresh(); } });
  const scopeName = (id: number | null) => (id === null ? "All tasks" : projects.find((p) => p.id === id)?.name ?? "Project");
  return (
    <div className="space-y-3">
      {fields.length > 0 ? <ul className="divide-y rounded-lg border">{fields.map((f, i) => (
        <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[14px]">
          <span className="font-medium">{f.name}</span><span className="rounded bg-raise px-1.5 py-0.5 text-xs text-mute">{TYPES.find((t) => t[0] === f.type)?.[1]}</span>
          <span className="text-xs text-dim">{scopeName(f.project_id)}{f.type === "select" ? ` · ${f.options.join(", ")}` : ""}</span>
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-mute"><input type="checkbox" checked={f.show_on_card} onChange={(e) => go(() => saveFieldAction({ ...f, show_on_card: e.target.checked }))} />Show on cards</label>
          <button aria-label={`Move ${f.name} up`} disabled={i === 0 || fields[i - 1].project_id !== f.project_id} onClick={() => go(() => moveFieldAction(f.id, -1))} className="rounded p-1 text-mute hover:bg-raise disabled:opacity-25"><Icon name="chevUp2" size={14} /></button>
          <button aria-label={`Move ${f.name} down`} disabled={i === fields.length - 1 || fields[i + 1].project_id !== f.project_id} onClick={() => go(() => moveFieldAction(f.id, 1))} className="rounded p-1 text-mute hover:bg-raise disabled:opacity-25"><Icon name="chevDown" size={14} /></button>
          <button aria-label={`Delete ${f.name}`} onClick={() => { if (confirm(`Delete the field “${f.name}”? Its values on tasks will be removed too.`)) go(() => deleteFieldAction(f.id)); }} className="rounded p-1 text-mute hover:bg-raise hover:text-danger"><Icon name="trash" size={14} /></button>
        </li>))}</ul> : <p className="rounded-lg border border-dashed px-3 py-5 text-center text-[13px] text-mute">No custom fields yet. Add things like Client, Cost, Link or Stage.</p>}
      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); go(() => saveFieldAction({ project_id: scope ? Number(scope) : null, name, type, options: options.split(/[,\n]/), show_on_card: card }), () => { setName(""); setOptions(""); setCard(false); toast("Field added"); }); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New field name, e.g. Client" aria-label="Field name" required className="field" />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Field type" className="field !w-auto">{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Applies to" className="field !w-auto"><option value="">All tasks</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name} only</option>)}</select>
        {type === "select" && <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Choices, separated by commas" aria-label="Choices" className="field sm:col-span-3" />}
        <div className="flex items-center gap-3 sm:col-span-3"><label className="inline-flex items-center gap-1.5 text-[13px] text-mute"><input type="checkbox" checked={card} onChange={(e) => setCard(e.target.checked)} />Show on board cards</label><button className="btn-primary ml-auto"><Icon name="plus" size={14} />Add field</button></div>
      </form>
    </div>
  );
}
