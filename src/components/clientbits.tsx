"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "./Icon";
import { aiAccept, aiApplyPlan, aiAsk, aiExtract, aiPlan, autoScheduleAction, saveNoteAction } from "@/lib/actions3";
import type { Plan, Proposal } from "@/lib/ai";
import { renderMarkdown } from "@/lib/markdown";

export function AutoSchedule({ date }: { date: string }) {
  const [p, go] = useTransition();
  return <button className="btn" disabled={p} onClick={() => go(async () => { const r = await autoScheduleAction(date); toast(r.scheduled.length ? `Scheduled ${r.scheduled.length} task${r.scheduled.length > 1 ? "s" : ""}${r.leftover.length ? `, ${r.leftover.length} didn't fit` : ""}` : r.leftover.length ? "No free slots left today" : "Nothing to schedule"); })}><Icon name="sparkles" size={14} />{p ? "Scheduling…" : "Auto-schedule"}</button>;
}

/** Markdown note editor: autosaves, with an edit/preview toggle. Preview HTML is rendered on the server and passed in. */
export function NoteEditor({ id, title, body, links }: { id: number; title: string; body: string; links: Record<string, number> }) {
  const [t, setT] = useState(title), [b, setB] = useState(body), [saved, setSaved] = useState<"saved" | "saving" | "err">("saved"), [mode, setMode] = useState<"edit" | "view">(body ? "view" : "edit");
  const first = useRef(true), timer = useRef<ReturnType<typeof setTimeout>>(undefined), [err, setErr] = useState("");
  useEffect(() => { if (first.current) { first.current = false; return; } setSaved("saving"); clearTimeout(timer.current); timer.current = setTimeout(async () => { const r = await saveNoteAction(id, { title: t, body: b }); setSaved(r.ok ? "saved" : "err"); setErr(r.ok ? "" : r.error); }, 600); return () => clearTimeout(timer.current); }, [t, b, id]);
  return (
    <div>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Untitled" aria-label="Title" className="w-full bg-transparent text-[28px] font-bold tracking-tight outline-none placeholder:text-dim md:text-[32px]" />
      <div className="mb-3 mt-2 flex items-center gap-3 text-xs text-mute">
        <div className="inline-flex rounded-md border p-0.5">{(["edit", "view"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded px-2.5 py-1 ${mode === m ? "bg-raise font-medium text-fg" : ""}`}>{m === "edit" ? "Write" : "Preview"}</button>)}</div>
        <span>{saved === "saving" ? "Saving…" : saved === "err" ? <span className="text-danger">{err || "Couldn't save"}</span> : "Saved"}</span>
      </div>
      {mode === "edit" ? <textarea value={b} onChange={(e) => setB(e.target.value)} placeholder={"Write in Markdown. Link notes with [[Note title]]."} aria-label="Note body" className="field min-h-[50vh] w-full resize-y font-mono text-[13.5px] leading-relaxed" />
        : <article className="prose-note" dangerouslySetInnerHTML={{ __html: renderMarkdown(b, (x) => links[x.toLowerCase()] ?? null) || "<p class=\"text-mute\">Nothing here yet.</p>" }} />}
    </div>
  );
}

export function PasteToTasks() {
  const [text, setText] = useState(""), [items, setItems] = useState<(Proposal & { keep: boolean })[] | null>(null), [p, go] = useTransition(), [err, setErr] = useState("");
  const run = () => go(async () => { setErr(""); const r = await aiExtract(text); if (r.ok) setItems(r.tasks.map((x) => ({ ...x, keep: true }))); else setErr(r.error); });
  const add = () => go(async () => { const n = await aiAccept(items!.filter((i) => i.keep)); toast(`Added ${n} task${n === 1 ? "" : "s"}`); setItems(null); setText(""); });
  return (
    <div className="space-y-3 p-4">
      {!items ? <>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste an email, meeting notes or a chat thread…" aria-label="Text to turn into tasks" className="field min-h-36 w-full resize-y" />
        {err && <p className="text-[13px] text-danger" role="alert">{err}</p>}
        <button className="btn-primary" disabled={p || !text.trim()} onClick={run}>{p ? "Reading…" : "Find tasks"}</button>
      </> : <>
        {items.length === 0 && <p className="text-sm text-mute">Nothing actionable in that text.</p>}
        <ul className="divide-y rounded-lg border">{items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 px-3 py-2.5"><input type="checkbox" checked={it.keep} onChange={() => setItems(items.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))} className="mt-1" aria-label={`Keep ${it.title}`} />
            <div className="min-w-0 flex-1"><input value={it.title} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="w-full bg-transparent text-[14px] font-medium outline-none" aria-label="Title" />
              <div className="text-xs text-mute">{[it.due, it.time, it.priority > 0 ? "high priority" : "", it.estimate_minutes ? `${it.estimate_minutes}m` : "", it.project, ...it.tags.map((t) => "#" + t)].filter(Boolean).join(" · ") || "No date"}</div></div></li>))}</ul>
        <div className="flex gap-2"><button className="btn-primary" disabled={p || !items.some((i) => i.keep)} onClick={add}>Add {items.filter((i) => i.keep).length} task{items.filter((i) => i.keep).length === 1 ? "" : "s"}</button><button className="btn" onClick={() => setItems(null)}>Back</button></div>
      </>}
    </div>
  );
}

export function PlanMyDay({ date }: { date: string }) {
  const [plan, setPlan] = useState<Plan | null>(null), [err, setErr] = useState(""), [p, go] = useTransition();
  return (
    <div className="space-y-3 p-4">
      {!plan ? <>
        <p className="text-[13px] text-mute">Claude reads what&apos;s due and your calendar, then proposes a realistic schedule. Nothing changes until you accept.</p>
        {err && <p className="text-[13px] text-danger" role="alert">{err}</p>}
        <button className="btn-primary" disabled={p} onClick={() => go(async () => { setErr(""); const r = await aiPlan(date); if (r.ok) setPlan(r.plan); else setErr(r.error); })}>{p ? "Thinking…" : "Plan my day"}</button>
      </> : <>
        <p className="text-[14px]">{plan.summary}</p>
        {plan.blocks.length > 0 && <ul className="divide-y rounded-lg border">{plan.blocks.sort((a, b) => a.start.localeCompare(b.start)).map((b) => <li key={b.task_id} className="flex gap-3 px-3 py-2 text-[13px]"><span className="w-12 shrink-0 font-medium tabular-nums">{b.start}</span><span className="min-w-0"><span className="font-medium">{b.title}</span> <span className="text-mute">· {b.minutes}m · {b.reason}</span></span></li>)}</ul>}
        {plan.defer.length > 0 && <div><div className="mb-1 text-xs font-medium text-mute">Move out of today</div><ul className="divide-y rounded-lg border">{plan.defer.map((d) => <li key={d.task_id} className="px-3 py-2 text-[13px]"><span className="font-medium">{d.title}</span> <span className="text-mute">→ {d.to === "nextweek" ? "next week" : d.to} · {d.reason}</span></li>)}</ul></div>}
        <div className="flex gap-2"><button className="btn-primary" disabled={p || (!plan.blocks.length && !plan.defer.length)} onClick={() => go(async () => { const n = await aiApplyPlan(plan, date); toast(`Updated ${n} task${n === 1 ? "" : "s"}`); setPlan(null); })}>Accept plan</button><button className="btn" onClick={() => setPlan(null)}>Discard</button></div>
      </>}
    </div>
  );
}

export function AskBox() {
  const [q, setQ] = useState(""), [a, setA] = useState(""), [err, setErr] = useState(""), [p, go] = useTransition();
  return (
    <form className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); go(async () => { setErr(""); setA(""); const r = await aiAsk(q); if (r.ok) setA(r.answer); else setErr(r.error); }); }}>
      <div className="flex gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What should I tackle first this afternoon?" aria-label="Question" className="field" /><button className="btn-primary" disabled={p || !q.trim()}>{p ? "…" : "Ask"}</button></div>
      {err && <p className="text-[13px] text-danger" role="alert">{err}</p>}{a && <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{a}</p>}
    </form>
  );
}
