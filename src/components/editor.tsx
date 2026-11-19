"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addSubtask, deleteTaskInline, duplicateTaskAction, patchTask, restoreTaskAction, startFocus, toggleTask } from "@/lib/actions";
import { Icon } from "./Icon";

export type EditorTask = { id: number; title: string; notes: string; status: "todo" | "doing" | "done"; priority: number; project_id: number | null; due: string | null; due_time: string | null; estimate: number | null; repeat: string; tags: string };
const parseEst = (s: string): number | null | undefined => { const m = s.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|m|min|mins)?$/); if (!s.trim()) return null; if (!m) return undefined; const n = parseFloat(m[1]); return Math.max(1, Math.round(m[2]?.startsWith("h") ? n * 60 : n)); };
const Prop = ({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 py-0.5 sm:grid-cols-[150px_minmax(0,1fr)]">
    <span className="flex items-center gap-2 px-1 text-[13px] text-mute"><Icon name={icon} size={15} />{label}</span>{children}</div>
);

/** Notion-style editor: every change saves itself, no Save button. */
export function TaskEditor({ task, projects, focus, children }: { task: EditorTask; projects: { id: number; name: string }[]; focus: boolean; children?: React.ReactNode }) {
  const router = useRouter();
  const [v, setV] = useState(task), [est, setEst] = useState(task.estimate ? `${task.estimate}m` : ""), [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined), pending = useRef<Record<string, unknown>>({});
  useEffect(() => () => clearTimeout(timer.current), []);
  const flush = async () => {
    const p = pending.current; pending.current = {}; if (!Object.keys(p).length) return;
    setState("saving"); const r = await patchTask(task.id, p);
    setState(r.ok ? "saved" : r.error);
  };
  const save = (patch: Record<string, unknown>, delay = 0) => { Object.assign(pending.current, patch); clearTimeout(timer.current); timer.current = setTimeout(() => void flush(), delay); };
  const set = <K extends keyof EditorTask>(k: K, val: EditorTask[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = state !== "idle" && state !== "saving" && state !== "saved";
  return (
    <>
      <div className="mb-1 flex h-5 items-center justify-end text-xs text-dim" aria-live="polite">{state === "saving" ? "Saving…" : state === "saved" ? <span className="inline-flex items-center gap-1 text-ok"><Icon name="check" size={12} />Saved</span> : err ? <span className="text-danger">{state}</span> : ""}</div>
      <input value={v.title} onChange={(e) => { set("title", e.target.value); if (e.target.value.trim()) save({ title: e.target.value }, 700); }} onBlur={() => void flush()} aria-label="Title"
        className="mb-5 w-full rounded-md bg-transparent px-1 py-1 text-[30px] font-bold leading-tight tracking-tight outline-none hover:bg-raise/60 focus:bg-raise/60" />
      <div className="space-y-0.5 border-y py-3">
        <Prop icon="circleCheck" label="Status"><select value={v.status} onChange={(e) => { set("status", e.target.value as EditorTask["status"]); save({ status: e.target.value }); }} className="ghost max-w-[15rem]"><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select></Prop>
        <Prop icon="chevUp2" label="Priority"><select value={v.priority} onChange={(e) => { set("priority", Number(e.target.value)); save({ priority: Number(e.target.value) }); }} className="ghost max-w-[15rem]"><option value={1}>High</option><option value={0}>Normal</option><option value={-1}>Low</option></select></Prop>
        <Prop icon="list" label="Project"><select value={v.project_id ?? ""} onChange={(e) => { const n = e.target.value ? Number(e.target.value) : null; set("project_id", n); save({ project_id: n }); }} className="ghost max-w-[15rem]"><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Prop>
        <Prop icon="calendar" label="Due date"><div className="flex min-w-0 flex-wrap gap-1.5"><input type="date" value={v.due ?? ""} onChange={(e) => { set("due", e.target.value || null); save(e.target.value ? { due: e.target.value } : { due: null, due_time: null }); if (!e.target.value) set("due_time", null); }} className="ghost !w-[9.5rem] shrink-0" />
          <input type="time" value={v.due_time ?? ""} disabled={!v.due} onChange={(e) => { set("due_time", e.target.value || null); save({ due_time: e.target.value || null }); }} className="ghost !w-[8.5rem] shrink-0 disabled:opacity-40" aria-label="Time" /></div></Prop>
        <Prop icon="clock" label="Estimate"><input value={est} onChange={(e) => setEst(e.target.value)} onBlur={() => { const n = parseEst(est); if (n === undefined) setState("Try 30m, 1h or 90"); else { set("estimate", n); save({ estimate: n }); void flush(); } }} placeholder="e.g. 30m, 1.5h" className="ghost max-w-[15rem]" /></Prop>
        <Prop icon="repeat" label="Repeat"><input value={v.repeat} onChange={(e) => set("repeat", e.target.value)} onBlur={() => { save({ repeat: v.repeat.trim() || null }); void flush(); }} placeholder="Doesn't repeat (try: weekly, every 2 weeks)" className="ghost max-w-md" /></Prop>
        <Prop icon="inbox" label="Tags"><input value={v.tags} onChange={(e) => set("tags", e.target.value)} onBlur={() => { save({ tags: v.tags }); void flush(); }} placeholder="Add tags, separated by spaces" className="ghost max-w-md" /></Prop>
      </div>
      <textarea value={v.notes} onChange={(e) => { set("notes", e.target.value); save({ notes: e.target.value }, 800); }} onBlur={() => void flush()} rows={8} placeholder="Add notes… links are picked up automatically"
        className="ghost mt-4 min-h-40 resize-y !px-1 !py-2 text-[15px] leading-relaxed" />
      {children}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
        {focus && <button className="btn" onClick={async () => { await startFocus(task.id); router.push(`/focus?task=${task.id}`); }}><Icon name="focus" size={15} className="text-accent" />Start focus</button>}
        <button className="btn" onClick={async () => { const n = await duplicateTaskAction(task.id); if (n) { toast("Task duplicated"); router.push(`/tasks/${n}`); } }}><Icon name="copy" size={15} />Duplicate</button>
        <button className="btn ml-auto text-danger" onClick={async () => { const r = await deleteTaskInline(task.id); if (r) { router.push("/tasks"); toast(`Deleted “${r.title}”`, { action: { label: "Undo", onClick: () => void restoreTaskAction(task.id).then(() => router.push(`/tasks/${task.id}`)) } }); } }}><Icon name="trash" size={15} />Delete</button>
      </div>
    </>
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
