"use client";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { quickAdd } from "@/lib/actions";
import { fmtMinutes, fmtTime, nice } from "@/lib/dates";
import { parseQuickAdd, repeatLabel } from "@/lib/parse";
import { Icon } from "./Icon";
import { clearDraft as dropDraft, peekDraft as getDraft } from "@/lib/drafts";
import { useSession } from "./session";
import { Pill } from "./Pill";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const SYNTAX: [string, string][] = [["#tag", "Label it"], ["@project", "File it in a project"], ["!high  !low  !doing", "Priority or status"], ["tomorrow · friday · in 3 days", "Due date"], ["daily · weekdays · every 2 weeks", "Repeat"]];

function Preview({ parsed, today, empty }: { parsed: ReturnType<typeof parseQuickAdd> | null; today: string; empty: boolean }) {
  const effDue = parsed?.due ?? (parsed?.due_time || parsed?.repeat ? today : null);
  const due = effDue ? (effDue === today ? "Today" : nice(effDue)) : null;
  if (parsed?.title) return (
    <div className="space-y-2">
      <div className="text-[15px] font-medium">{parsed.title}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-mute">
        {due && <span className="inline-flex items-center gap-1 rounded bg-warn/10 px-1.5 py-0.5 font-medium text-warn"><Icon name="calendar" size={12} />{due}{parsed?.due_time && <span className="font-normal"> · {fmtTime(parsed.due_time)}</span>}</span>}
        {parsed?.estimate ? <span className="inline-flex items-center gap-1 rounded bg-raise px-1.5 py-0.5"><Icon name="clock" size={12} />{fmtMinutes(parsed.estimate)}</span> : null}
        {parsed.repeat && <span className="inline-flex items-center gap-1 rounded bg-raise px-1.5 py-0.5"><Icon name="repeat" size={12} />{repeatLabel(parsed.repeat)}</span>}
        {parsed.project && <span className="rounded bg-raise px-1.5 py-0.5 font-medium text-fg">{parsed.project}</span>}
        {parsed.tags?.map((t) => <Pill key={t} name={t} />)}
        {parsed.priority === 1 && <span className="inline-flex items-center gap-0.5 rounded bg-danger/10 px-1.5 py-0.5 font-medium text-danger"><Icon name="chevUp2" size={12} />High</span>}
        {parsed.priority === -1 && <span className="rounded bg-raise px-1.5 py-0.5">Low priority</span>}
        {parsed.status === "doing" && <span className="lozenge bg-accent/15 text-accent">In progress</span>}
        {!due && !parsed.repeat && !parsed.project && !parsed.tags && !parsed.estimate && <span className="inline-flex items-center gap-1"><Icon name="inbox" size={12} />Goes to your inbox</span>}
      </div>
    </div>
  );
  if (empty) return (
    <div><div className="mb-2 text-xs font-semibold text-mute">Type naturally, I'll pick out the details</div>
      <dl className="grid gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-[auto_1fr]">{SYNTAX.map(([k, d]) => (<div key={k} className="contents"><dt className="font-medium text-accent">{k}</dt><dd className="text-mute">{d}</dd></div>))}</dl></div>
  );
  return null;
}

export function CaptureForm({ today, variant, onDone }: { today: string; variant: "pill" | "sheet"; onDone?: () => void }) {
  const [v, setV] = useState(""), [focus, setFocus] = useState(false), [ok, setOk] = useState(false);
  const { guarded } = useSession(), dk = `capture:${variant}`;
  useEffect(() => { const d = getDraft<string>(dk); if (d?.value?.trim()) setV(d.value); }, [dk]);
  useEffect(() => { if (v.trim()) { try { localStorage.setItem(`lifeos:draft:${dk}`, JSON.stringify({ value: v, at: Date.now() })); } catch { /* ignore */ } } else dropDraft(dk); }, [v, dk]);
  const pid = usePathname().match(/^\/projects\/(\d+)/)?.[1], router = useRouter();
  /** Pasting several lines adds one task per line. */
  const paste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const lines = e.clipboardData.getData("text").split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, "").trim()).filter(Boolean);
    if (lines.length < 2 || lines.length > 50) return;
    e.preventDefault();
    for (const l of lines) { const fd = new FormData(); fd.set("text", l); if (pid) fd.set("project_id", pid); await quickAdd(fd); }
    toast(`Added ${lines.length} tasks`); router.refresh();
  };
  const parsed = useMemo(() => { if (!v.trim()) return null; try { return parseQuickAdd(v, today); } catch { return null; } }, [v, today]);
  const sheet = variant === "sheet", formRef = useRef<HTMLFormElement>(null), base = useRef(""), vRef = useRef(""); vRef.current = v;
  const action = async (fd: FormData) => {
    if (!parsed?.title) return;
    const g = await guarded(`capture-save:${dk}`, v, async () => { await quickAdd(fd); });
    if (!g.saved) return; // text stays in the box (and in local storage) until it really saved
    setV(""); setOk(true); setTimeout(() => setOk(false), 1800); onDone?.();
  };

  return (
    <form ref={formRef} className="relative" action={action}>
      {pid && <input type="hidden" name="project_id" value={pid} />}
      <div className={`flex items-center gap-2 transition ${sheet ? "rounded-xl border bg-panel px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25" : "rounded-full bg-raise px-3.5 hover:bg-raise/70 focus-within:bg-panel focus-within:shadow-[0_0_0_2px_rgb(var(--accent)/0.5)]"}`}>
        <Icon name={ok ? "check" : "plus"} size={16} className={ok ? "text-ok" : "text-mute"} />
        <input id={sheet ? undefined : "capture"} name="text" value={v} onChange={(e) => setV(e.target.value)} onPaste={paste} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} autoFocus={sheet}
          autoComplete="off" enterKeyHint="done" placeholder={ok ? "Added!" : "Add a task…  e.g. Call mum friday #family"} className={`min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-mute ${sheet ? "py-3 text-base" : "py-2"}`} />
        <Mic onStart={() => { base.current = vRef.current.trim(); }} onChange={(t) => setV((base.current ? base.current + " " : "") + t)} onDone={() => { setTimeout(() => formRef.current?.requestSubmit(), 60); }} />
        {!sheet && !v && <kbd className="hidden rounded border bg-panel px-1.5 text-[11px] text-dim lg:block">C</kbd>}
      </div>
      {sheet ? (
        <div className="mt-3 min-h-14"><Preview parsed={parsed} today={today} empty={!v} /></div>
      ) : (
        focus && (parsed?.title || !v) && <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl border bg-panel p-3.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)]"><Preview parsed={parsed} today={today} empty={!v} /></div>
      )}
      {sheet && <button className="btn-primary mt-3 !h-11 w-full !text-[15px]" disabled={!parsed?.title}>Add task</button>}
    </form>
  );
}

type Proj = { id: number; name: string; color: string };
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Phone quick add, in the style of a to-do app: title and notes, then a row of date / priority / tag / project, and a send button above the keyboard. */
function QuickSheet({ today, projects, onDone }: { today: string; projects: Proj[]; onDone: () => void }) {
  const path = usePathname(), ctxProject = path.match(/^\/projects\/(\d+)/)?.[1] ?? (path === "/board" ? new URLSearchParams(window.location.search).get("project") ?? undefined : undefined), formRef = useRef<HTMLFormElement>(null);
  const [v, setV] = useState(""), [notes, setNotes] = useState(""), [due, setDue] = useState<string>(path === "/" || path === "/now" ? today : ""), [prio, setPrio] = useState(0), [tags, setTags] = useState(""), [proj, setProj] = useState(ctxProject ?? "");
  const [pop, setPop] = useState<null | "date" | "prio" | "proj" | "tag">(null), [busy, setBusy] = useState(false), base = useRef(""), vRef = useRef(""); vRef.current = v;
  const { guarded } = useSession();
  const parsed = useMemo(() => { if (!v.trim()) return null; try { return parseQuickAdd(v, today); } catch { return null; } }, [v, today]);
  const submit = async (fd: FormData) => {
    if (!parsed?.title || busy) return; setBusy(true);
    const g = await guarded("capture-save:sheet", v, async () => { await quickAdd(fd); });
    setBusy(false); if (g.saved) onDone();
  };
  const effDue = parsed?.due ?? due, pname = projects.find((p) => String(p.id) === proj)?.name;
  const chip = (on: boolean) => `inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full text-[13px] ${on ? "bg-accent/10 px-3 text-accent" : "w-10 text-mute hover:bg-raise"}`;
  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[14px] hover:bg-raise";
  return (
    <form ref={formRef} action={submit}>
      <input type="hidden" name="due" value={due} /><input type="hidden" name="priority" value={prio} /><input type="hidden" name="tags" value={tags} /><input type="hidden" name="project_id" value={proj} />
      <input name="text" value={v} onChange={(e) => setV(e.target.value)} autoFocus autoComplete="off" enterKeyHint="done" aria-label="Task title" placeholder="What needs doing?" className="w-full bg-transparent py-1.5 text-[18px] font-medium outline-none placeholder:text-dim" />
      <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} aria-label="Notes" placeholder="Add notes" onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px"; }} className="w-full resize-none bg-transparent py-1 text-[14px] outline-none placeholder:text-dim" />
      {parsed?.title && (parsed.due || parsed.tags || parsed.project || parsed.estimate || parsed.repeat || parsed.priority) ? <div className="mb-1"><Preview parsed={parsed} today={today} empty={false} /></div> : null}
      {pop && <div className="mb-2 rounded-xl border bg-panel p-1.5 shadow-lg">
        {pop === "date" && <>{([["Today", 0], ["Tomorrow", 1], ["Next week", 7]] as const).map(([l, n]) => <button type="button" key={l} className={item} onClick={() => { setDue(addDays(today, n)); setPop(null); }}><Icon name="calendar" size={15} className="text-mute" />{l}<span className="ml-auto text-xs text-dim">{nice(addDays(today, n)).split(", ")[0]}</span></button>)}
          <label className={`${item} cursor-pointer`}><Icon name="calendar" size={15} className="text-mute" />Pick a date…<input type="date" value={due} onChange={(e) => { setDue(e.target.value); setPop(null); }} className="ml-auto bg-transparent text-sm" /></label>
          {due && <button type="button" className={`${item} text-mute`} onClick={() => { setDue(""); setPop(null); }}>No date</button>}</>}
        {pop === "prio" && ([[1, "High"], [0, "Normal"], [-1, "Low"]] as const).map(([n, l]) => <button type="button" key={l} className={`${item} ${prio === n ? "font-medium text-accent" : ""}`} onClick={() => { setPrio(n); setPop(null); }}><Icon name={n > 0 ? "chevUp2" : n < 0 ? "chevDown1" : "flag"} size={15} className={n > 0 ? "text-danger" : "text-mute"} />{l}</button>)}
        {pop === "proj" && <div className="max-h-56 overflow-y-auto"><button type="button" className={`${item} ${!proj ? "font-medium text-accent" : ""}`} onClick={() => { setProj(""); setPop(null); }}><Icon name="inbox" size={15} className="text-mute" />Inbox</button>{projects.map((p) => <button type="button" key={p.id} className={`${item} ${String(p.id) === proj ? "font-medium text-accent" : ""}`} onClick={() => { setProj(String(p.id)); setPop(null); }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.name}</button>)}</div>}
        {pop === "tag" && <div className="p-1.5"><input autoFocus value={tags} onChange={(e) => setTags(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setPop(null); } }} placeholder="Tags, separated by spaces" aria-label="Tags" className="field" /></div>}
      </div>}
      <div className="mt-1 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
        <button type="button" onClick={() => setPop(pop === "date" ? null : "date")} aria-label="Date" className={chip(!!effDue)}><Icon name="calendar" size={15} />{effDue ? (effDue === today ? "Today" : nice(effDue).split(", ")[1] ?? nice(effDue)) : null}</button>
        <button type="button" onClick={() => setPop(pop === "prio" ? null : "prio")} aria-label="Priority" className={chip(prio !== 0 || !!parsed?.priority)}><Icon name="flag" size={15} />{prio > 0 ? "High" : prio < 0 ? "Low" : null}</button>
        <button type="button" onClick={() => setPop(pop === "tag" ? null : "tag")} aria-label="Tags" className={chip(!!tags.trim())}><Icon name="tag" size={15} />{tags.trim() ? tags.trim().split(/\s+/).slice(0, 2).join(" ") : null}</button>
        <button type="button" onClick={() => setPop(pop === "proj" ? null : "proj")} aria-label="Project" className={chip(!!proj)}><Icon name="list" size={15} />{pname && <span className="max-w-[7rem] truncate">{pname}</span>}</button>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          <Mic onStart={() => { base.current = vRef.current.trim(); }} onChange={(t) => setV((base.current ? base.current + " " : "") + t)} onDone={() => { setTimeout(() => formRef.current?.requestSubmit(), 60); }} />
          <button aria-label="Add task" disabled={!parsed?.title || busy} className="grid h-10 w-10 place-items-center rounded-full bg-accent text-ink disabled:opacity-40"><Icon name="arrowUp" size={20} /></button>
        </span>
      </div>
    </form>
  );
}

export function CaptureFab({ today, projects = [] }: { today: string; projects?: Proj[] }) {
  const [open, setOpen] = useState(false), [lift, setLift] = useState(0);
  useEffect(() => { const f = () => setOpen(true); window.addEventListener("lifeos:capture", f); return () => window.removeEventListener("lifeos:capture", f); }, []);
  // keep the sheet just above the on-screen keyboard
  useEffect(() => { if (!open) return; const vv = window.visualViewport; if (!vv) return; const f = () => setLift(Math.max(0, window.innerHeight - vv.height - vv.offsetTop)); f(); vv.addEventListener("resize", f); vv.addEventListener("scroll", f); return () => { vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); setLift(0); }; }, [open]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open]);
  const path = usePathname();
  return (
    <>
      {!path.startsWith("/settings") && <button onClick={() => setOpen(true)} aria-label="New task" className="fab fixed bottom-[76px] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-accent text-ink shadow-[0_6px_18px_rgb(24_119_242/0.45)] transition active:scale-95 md:hidden"><Icon name="plus" size={26} /></button>}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)} onTouchStart={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-label="New task" style={{ bottom: lift }} className="absolute inset-x-0 rounded-t-2xl bg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
            <QuickSheet today={today} projects={projects} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

type Rec = { lang: string; continuous: boolean; interimResults: boolean; onresult: (e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void; onend: () => void; onerror: (e: { error: string }) => void; start: () => void; stop: () => void };
/**
 * Voice for the add-task bar. Hold the button and talk, let go and the task is added. Or tap once to start and again to stop.
 * Uses the browser's built-in speech recognition (hidden where it isn't available, e.g. Firefox).
 */
function Mic({ onStart, onChange, onDone }: { onStart: () => void; onChange: (text: string) => void; onDone: (text: string) => void }) {
  const [on, setOn] = useState(false), [can, setCan] = useState(false), [tap, setTap] = useState(false), [err, setErr] = useState("");
  const rec = useRef<Rec | null>(null), text = useRef(""), finishing = useRef(false), mode = useRef<"hold" | "tap" | null>(null), downAt = useRef(0), ignoreUp = useRef(false);
  useEffect(() => { const w = window as never as Record<string, unknown>; setCan(!!(w.SpeechRecognition || w.webkitSpeechRecognition)); return () => rec.current?.stop(); }, []);
  if (!can) return null;
  const start = () => {
    const W = window as never as Record<string, new () => Rec>, R = W.SpeechRecognition || W.webkitSpeechRecognition; setErr(""); text.current = ""; onStart();
    const r = new R(); r.lang = navigator.language || "en-NZ"; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => { text.current = Array.from(e.results).map((x) => x[0].transcript).join(" ").replace(/\s+/g, " ").trim(); onChange(text.current); };
    r.onerror = (e) => { setErr(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone blocked. Allow it in the address bar." : e.error === "no-speech" ? "Didn't hear anything." : "Voice isn't available right now."); setOn(false); setTap(false); mode.current = null; finishing.current = false; };
    r.onend = () => { setOn(false); setTap(false); mode.current = null; if (finishing.current) { finishing.current = false; if (text.current) onDone(text.current); } };
    rec.current = r; mode.current = "hold"; downAt.current = Date.now(); setOn(true); r.start();
  };
  const finish = () => { if (rec.current) { finishing.current = true; rec.current.stop(); } };
  const press = () => { if (on && mode.current === "tap") { ignoreUp.current = true; finish(); return; } if (!on) start(); };
  const release = () => { if (ignoreUp.current) { ignoreUp.current = false; return; } if (!on || mode.current !== "hold") return; if (Date.now() - downAt.current < 350) { mode.current = "tap"; setTap(true); return; } finish(); };
  return (
    <span className="relative flex shrink-0 items-center">
      <button type="button" aria-label={on ? "Listening" : "Hold to talk"} aria-pressed={on} title={on ? (tap ? "Tap again to add" : "Let go to add the task") : "Hold to talk, let go to add the task (or tap to start and stop)"}
        onContextMenu={(e) => e.preventDefault()} onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); press(); }} onPointerUp={release} onPointerCancel={release}
        className={`relative grid h-8 w-8 touch-none select-none place-items-center rounded-full transition ${on ? "scale-110 bg-danger text-white" : "bg-accent/15 text-accent hover:bg-accent hover:text-ink"}`}>
        {on && <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" aria-hidden />}
        <Icon name="mic" size={16} className="relative" />
      </button>
      {(err || (on && tap)) && <span className="absolute right-0 top-full z-40 mt-2 whitespace-nowrap rounded-lg border bg-panel px-2.5 py-1 text-xs shadow-md" role="status">{err || "Listening… tap to add"}</span>}
    </span>
  );
}
