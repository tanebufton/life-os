"use client";
import { SaveStatus } from "./savestatus";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addSubtask, deleteTaskInline, duplicateTaskAction, patchTask, restoreTaskAction, startFocus, toggleTask } from "@/lib/actions";
import { Icon } from "./Icon";
import { MarkdownField } from "./mdfield";
import { ago, clearDraft, peekDraft } from "@/lib/drafts";
import { RestoreBanner, useSession } from "./session";

export type EditorTask = { id: number; title: string; notes: string; status: string; priority: number; project_id: number | null; due: string | null; due_time: string | null; estimate: number | null; repeat: string; tags: string };
const parseEst = (s: string): number | null | undefined => { const m = s.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|m|min|mins)?$/); if (!s.trim()) return null; if (!m) return undefined; const n = parseFloat(m[1]); return Math.max(1, Math.round(m[2]?.startsWith("h") ? n * 60 : n)); };
const Prop = ({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2 py-0.5">
    <span className="flex items-center gap-2 px-1 text-[13px] text-mute"><Icon name={icon} size={15} />{label}</span>{children}</div>
);

/** Notion-style editor: every change saves itself, no Save button. */
/** Enter commits a field that otherwise saves when you leave it. */
const enterBlur = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.blur(); } };
export function TaskEditor({ task, projects, focus, columns, head, children }: { task: EditorTask; projects: { id: number; name: string }[]; focus: boolean; columns?: Record<string, { key: string; name: string; kind: string }[]>; head?: React.ReactNode; children?: React.ReactNode }) {
  const router = useRouter();
  const [v, setV] = useState(task), [est, setEst] = useState(task.estimate ? `${task.estimate}m` : ""), [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined), pending = useRef<Record<string, unknown>>({}), unsaved = useRef<Record<string, unknown>>({});
  const { guarded } = useSession(), dkey = `task:${task.id}`, [found, setFound] = useState<{ value: Record<string, unknown>; at: number } | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { const d = peekDraft<Record<string, unknown>>(dkey); if (d && Object.keys(d.value ?? {}).length) setFound(d); }, [dkey]);
  const flush = async () => {
    const p = pending.current; pending.current = {}; if (!Object.keys(p).length) return;
    Object.assign(unsaved.current, p); setState("saving");
    const g = await guarded(dkey, unsaved.current, () => patchTask(task.id, { ...unsaved.current }), () => { unsaved.current = {}; setState("saved"); });
    if (g.saved) { unsaved.current = {}; setState("saved"); }
    else if (g.reason && g.reason !== "error") setState("Not saved yet. Kept safely in this browser");
    else setState((g.result as { error?: string } | undefined)?.error ?? "Couldn't save. Try again");
  };
  const save = (patch: Record<string, unknown>, delay = 0) => { Object.assign(pending.current, patch); clearTimeout(timer.current); timer.current = setTimeout(() => void flush(), delay); };
  const set = <K extends keyof EditorTask>(k: K, val: EditorTask[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = state !== "idle" && state !== "saving" && state !== "saved";
  const restore = () => { if (!found) return; const p = found.value; setV((s) => ({ ...s, ...(p as Partial<EditorTask>), repeat: p.repeat === undefined ? s.repeat : String(p.repeat ?? ""), tags: p.tags === undefined ? s.tags : String(p.tags ?? "") })); if (typeof p.estimate === "number") setEst(`${p.estimate}m`); save(p); setFound(null); };
  const cols = columns?.[String(v.project_id ?? 0)] ?? [];
  const changeProject = (n: number | null) => { // a task moved to another project lands in the matching column there
    const oldKind = (columns?.[String(v.project_id ?? 0)] ?? []).find((c) => c.key === v.status)?.kind ?? "todo", next = columns?.[String(n ?? 0)] ?? [];
    const st = next.find((c) => c.key === v.status)?.key ?? next.find((c) => c.kind === oldKind)?.key ?? next[0]?.key ?? v.status;
    set("project_id", n); set("status", st); save({ project_id: n });
  };
  return (
    <div className="grid items-start gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        {found && <RestoreBanner at={ago(found.at)} what="edits to this task" onRestore={restore} onDiscard={() => { clearDraft(dkey); setFound(null); }} />}
        {head}
        <input value={v.title} onChange={(e) => { set("title", e.target.value); if (e.target.value.trim()) save({ title: e.target.value }, 700); }} onBlur={() => void flush()} aria-label="Title"
          className="w-full rounded-md bg-transparent px-1 py-1 text-[28px] font-bold leading-tight tracking-tight outline-none hover:bg-raise/60 focus:bg-raise/60 md:text-[30px]" />
      </div>
      <aside className="rounded-xl border bg-panel p-3 lg:col-start-2 lg:row-span-3 lg:row-start-1" aria-label="Properties">
        <div className="mb-1 flex min-h-6 items-center justify-between px-1 text-xs text-dim"><span className="font-semibold text-mute">Properties</span><SaveStatus state={state === "idle" ? "idle" : state === "saving" ? "saving" : state === "saved" ? "saved" : "error"} error={err ? state : undefined} /></div>
        <div className="space-y-0.5">
          <Prop icon="circleCheck" label="Status"><select value={v.status} onChange={(e) => { set("status", e.target.value); save({ status: e.target.value }); }} className="ghost max-w-full">{cols.length ? cols.map((c) => <option key={c.key} value={c.key}>{c.name}</option>) : <><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></>}</select></Prop>
          <Prop icon="chevUp2" label="Priority"><select value={v.priority} onChange={(e) => { set("priority", Number(e.target.value)); save({ priority: Number(e.target.value) }); }} className="ghost max-w-full"><option value={1}>High</option><option value={0}>Normal</option><option value={-1}>Low</option></select></Prop>
          <Prop icon="list" label="Project"><select value={v.project_id ?? ""} onChange={(e) => changeProject(e.target.value ? Number(e.target.value) : null)} className="ghost max-w-full"><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Prop>
          <Prop icon="calendar" label="Due date"><div className="flex min-w-0 flex-wrap gap-1.5"><input type="date" value={v.due ?? ""} onChange={(e) => { set("due", e.target.value || null); save(e.target.value ? { due: e.target.value } : { due: null, due_time: null }); if (!e.target.value) set("due_time", null); }} className="ghost !w-[9.5rem] shrink-0" />
            <input type="time" value={v.due_time ?? ""} disabled={!v.due} onChange={(e) => { set("due_time", e.target.value || null); save({ due_time: e.target.value || null }); }} className="ghost !w-[8.5rem] shrink-0 disabled:opacity-40" aria-label="Time" /></div></Prop>
          <Prop icon="clock" label="Estimate"><input value={est} onChange={(e) => setEst(e.target.value)} onBlur={() => { const n = parseEst(est); if (n === undefined) setState("Try 30m, 1h or 90"); else { set("estimate", n); save({ estimate: n }); void flush(); } }} placeholder="e.g. 30m, 1.5h" onKeyDown={enterBlur} className="ghost max-w-full" /></Prop>
          <Prop icon="repeat" label="Repeat"><input value={v.repeat} onChange={(e) => set("repeat", e.target.value)} onBlur={() => { save({ repeat: v.repeat.trim() || null }); void flush(); }} placeholder="Doesn't repeat" title="Try: weekly, every 2 weeks, 15th of the month" onKeyDown={enterBlur} className="ghost max-w-full" /></Prop>
          <Prop icon="tag" label="Tags"><input value={v.tags} onChange={(e) => set("tags", e.target.value)} onBlur={() => { save({ tags: v.tags }); void flush(); }} placeholder="Add tags" title="Separate tags with spaces. Press Enter to save." onKeyDown={enterBlur} className="ghost max-w-full" /></Prop>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          {focus && <button className="btn !h-8" onClick={async () => { await startFocus(task.id); router.push(`/focus?task=${task.id}`); }}><Icon name="focus" size={15} className="text-accent" />Focus</button>}
          <button className="btn !h-8" onClick={async () => { const n = await duplicateTaskAction(task.id); if (n) { toast("Task duplicated"); router.push(`/tasks/${n}`); } }}><Icon name="copy" size={15} />Duplicate</button>
          <button className="btn !h-8 ml-auto text-danger" onClick={async () => { const r = await deleteTaskInline(task.id); if (r) { router.push("/tasks"); toast(`Deleted “${r.title}”`, { action: { label: "Undo", onClick: () => void restoreTaskAction(task.id).then(() => router.push(`/tasks/${task.id}`)) } }); } }}><Icon name="trash" size={15} />Delete</button>
        </div>
      </aside>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <MarkdownField value={v.notes} onChange={(x) => { set("notes", x); save({ notes: x }, 800); }} onBlur={() => void flush()} rows={10} label="Notes" placeholder="Add notes. Markdown works: **bold**, lists, checklists. Links are picked up automatically." defaultMode={v.notes ? "view" : "edit"} />
        {children}
      </div>
    </div>
  );
}

export function SubtaskList({ parentId, items }: { parentId: number; items: { id: number; title: string; done: boolean }[] }) {
  const [list, setList] = useState(items), [text, setText] = useState(""), [, start] = useTransition();
  useEffect(() => setList(items), [items]);
  const done = list.filter((i) => i.done).length;
  return (
    <section className="mt-6" aria-label="Subtasks">
      <div className="mb-2 flex items-center gap-3"><h2 className="text-[13px] font-semibold">Subtasks</h2>
        {list.length > 0 && <><div className="h-1.5 w-28 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full bg-ok transition-all" style={{ width: `${(done / list.length) * 100}%` }} /></div><span className="text-xs text-mute">{done}/{list.length}</span></>}</div>
      <ul>{list.map((s) => (
        <li key={s.id} className="group flex items-center gap-3 border-b px-1 py-2 last:border-b-0">
          <button aria-label={s.done ? "Reopen" : "Complete"} onClick={() => { setList((l) => l.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x))); start(async () => { await toggleTask(s.id); }); }}
            className={`grid h-[17px] w-[17px] place-items-center rounded-full border-[1.5px] ${s.done ? "border-ok bg-ok text-white" : "border-fg/35 hover:bg-fg/5"}`}><Icon name="check" size={11} className={s.done ? "" : "opacity-0"} /></button>
          <Link href={`/tasks/${s.id}`} className={`flex-1 truncate text-[14px] ${s.done ? "text-dim line-through" : ""}`}>{s.title}</Link>
        </li>))}</ul>
      <form onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (!t) return; setList((l) => [...l, { id: -Date.now(), title: t, done: false }]); setText(""); start(async () => { await addSubtask(parentId, t); }); }} className="mt-1 flex items-center gap-2.5 px-1">
        <span className="grid h-[17px] w-[17px] place-items-center text-accent"><Icon name="plus" size={15} /></span>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a subtask" className="w-full bg-transparent py-2 text-[14px] outline-none placeholder:text-dim" />
      </form>
    </section>
  );
}
