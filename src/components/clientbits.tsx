"use client";
import { SaveStatus } from "./savestatus";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "./Icon";
import { aiAccept, aiApplyPlan, aiAsk, aiExtract, aiPlan, autoScheduleAction, noteRevAction, saveAsNewNoteAction, saveNoteAction, type NoteSave } from "@/lib/actions3";
import type { Plan, Proposal } from "@/lib/ai";
import { renderMarkdown } from "@/lib/markdown";
import { ago, clearDraft, peekDraft } from "@/lib/drafts";
import { RestoreBanner, useSession } from "./session";
import { MarkdownField } from "./mdfield";

export function AutoSchedule({ date }: { date: string }) {
  const [p, go] = useTransition();
  return <button className="btn" disabled={p} onClick={() => go(async () => { const r = await autoScheduleAction(date); toast(r.scheduled.length ? `Scheduled ${r.scheduled.length} task${r.scheduled.length > 1 ? "s" : ""}${r.leftover.length ? `, ${r.leftover.length} didn't fit` : ""}` : r.leftover.length ? "No free slots left today" : "Nothing to schedule"); })}><Icon name="sparkles" size={14} />{p ? "Scheduling…" : "Auto-schedule"}</button>;
}

/** Markdown note editor: autosaves, with an edit/preview toggle. Preview HTML is rendered on the server and passed in. */
export function NoteEditor({ id, title, body, rev, links, lead, meta }: { id: number; title: string; body: string; rev: number; links: Record<string, number>; lead?: React.ReactNode; meta?: React.ReactNode }) {
  const { guarded } = useSession(), key = `note:${id}`, router = useRouter();
  const [t, setT] = useState(title), [b, setB] = useState(body), [saved, setSaved] = useState<"saved" | "saving" | "kept" | "err">("saved");
  const first = useRef(true), timerPending = useRef(false), skip = useRef(false), revRef = useRef(rev), timer = useRef<ReturnType<typeof setTimeout>>(undefined), [err, setErr] = useState(""), [found, setFound] = useState<{ value: { title: string; body: string }; at: number } | null>(null);
  const [conflict, setConflict] = useState<{ title: string; body: string; rev: number; updated_at: string } | null>(null), mine = useRef({ t, b }); mine.current = { t, b };
  useEffect(() => { const d = peekDraft<{ title: string; body: string }>(key); if (d && (d.value.title !== title || d.value.body !== body)) setFound(d); else if (d) clearDraft(key); }, [key, title, body]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (skip.current) { skip.current = false; return; } // text just replaced by a newer version from elsewhere: nothing of ours to save
    setSaved("saving"); clearTimeout(timer.current); timerPending.current = true;
    timer.current = setTimeout(async () => {
      timerPending.current = false;
      const g = await guarded(key, { title: t, body: b }, () => saveNoteAction(id, { title: t, body: b }, revRef.current), () => setSaved("saved"));
      const r = g.result as NoteSave | undefined;
      if (g.saved && r?.ok) { revRef.current = r.rev; setSaved("saved"); setErr(""); }
      else if (r && !r.ok && r.conflict && r.current) { setConflict(r.current); setSaved("err"); setErr("Changed somewhere else"); }
      else if (g.reason && g.reason !== "error") setSaved("kept"); else { setSaved("err"); setErr(r && !r.ok ? r.error : "Couldn't save"); }
    }, 600);
    return () => clearTimeout(timer.current);
  }, [t, b, id, key, guarded]);
  // Leaving the page within the pause after typing must not lose the last edit.
  useEffect(() => () => { if (timerPending.current) void saveNoteAction(id, { title: mine.current.t, body: mine.current.b }, revRef.current); }, [id]);
  // Coming back to this tab: if another device saved a newer version and we have nothing unsaved, load it; if we do, say so.
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState === "hidden" || conflict) return; const cur = await noteRevAction(id); if (!cur || cur.rev === revRef.current) return;
      if (saved === "saved") { skip.current = true; revRef.current = cur.rev; setT(cur.title); setB(cur.body); toast("Updated with changes made on another device"); router.refresh(); }
    };
    window.addEventListener("focus", check); document.addEventListener("visibilitychange", check); return () => { window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [id, saved, conflict, router]);
  const useTheirs = () => { if (!conflict) return; skip.current = true; revRef.current = conflict.rev; setT(conflict.title); setB(conflict.body); clearDraft(key); setConflict(null); setSaved("saved"); setErr(""); };
  const keepMine = async () => { if (!conflict) return; const r = await saveNoteAction(id, { title: mine.current.t, body: mine.current.b }, conflict.rev, true); if (r.ok) { revRef.current = r.rev; setConflict(null); setSaved("saved"); setErr(""); clearDraft(key); toast("Saved your version. The other one is kept in History."); router.refresh(); } else toast(r.error); };
  const both = async () => { if (!conflict) return; const nid = await saveAsNewNoteAction(mine.current.t, mine.current.b); toast("Your edits were saved as a new note"); useTheirs(); router.refresh(); void nid; };
  return (
    <div>
      {conflict && (
        <div role="alert" className="mb-3 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2.5 text-[13px]">
          <p className="font-medium text-warn">This note was changed somewhere else (another tab or device) while you were editing.</p>
          <p className="mt-0.5 text-mute">Your edits haven&apos;t been saved yet, and nothing has been overwritten. Choose what to keep:</p>
          <div className="mt-2 flex flex-wrap gap-2"><button className="btn !h-8" onClick={keepMine}>Keep my version</button><button className="btn !h-8" onClick={useTheirs}>Use the other version</button><button className="btn !h-8" onClick={both}>Keep both (mine as a new note)</button></div>
        </div>)}
      {found && <RestoreBanner at={ago(found.at)} what="edits to this note" onRestore={() => { setT(found.value.title); setB(found.value.body); setFound(null); }} onDiscard={() => { clearDraft(key); setFound(null); }} />}
      <div className="flex items-center gap-2">{lead}<input value={t} onChange={(e) => setT(e.target.value)} placeholder="Untitled" aria-label="Title" className="min-w-0 flex-1 bg-transparent text-[22px] font-bold tracking-tight outline-none placeholder:text-dim md:text-[32px]" /></div>
      <SaveStatus className="mb-3 mt-1.5" state={saved === "err" ? "error" : saved} error={err} />
      {meta}
      <MarkdownField value={b} onChange={setB} links={links} label="Note body" rows={18} defaultMode={body ? "view" : "edit"} placeholder="Write in Markdown. Link notes with [[Note title]]." />
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
