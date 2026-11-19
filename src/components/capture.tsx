"use client";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { quickAdd, quickSpend } from "@/lib/actions";
import { fmtMoney, parseMoneyQuick } from "@/lib/moneyfmt";
import { fmtMinutes, fmtTime, nice } from "@/lib/dates";
import { describeRepeat, parseQuickAdd } from "@/lib/parse";
import { Icon } from "./Icon";
import { clearDraft as dropDraft, peekDraft as getDraft } from "@/lib/drafts";
import { useSession } from "./session";
import { Pill } from "./Pill";

const SYNTAX: [string, string][] = [["#tag", "label it"], ["@project", "file it in a project"], ["!high  !low  !doing", "priority or status"], ["tomorrow · friday · in 3 days", "due date"], ["daily · weekdays · every 2 weeks", "repeat"]];

function Preview({ v, parsed, today, empty, mq, cur }: { v: string; parsed: ReturnType<typeof parseQuickAdd> | null; today: string; empty: boolean; mq?: ReturnType<typeof parseMoneyQuick>; cur?: string }) {
  if (mq) return (<div className="space-y-2"><div className="text-[15px] font-medium">{mq.payee || (mq.amount_cents < 0 ? "Expense" : "Income")}</div><div className="flex flex-wrap items-center gap-1.5 text-xs"><span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${mq.amount_cents < 0 ? "bg-danger/10 text-danger" : "bg-ok/10 text-ok"}`}><Icon name="wallet" size={12} />{mq.amount_cents < 0 ? "Expense" : "Income"} {fmtMoney(Math.abs(mq.amount_cents), cur ?? "USD")}</span>{mq.category && <span className="rounded bg-raise px-1.5 py-0.5 font-medium">{mq.category}</span>}{mq.date && <span className="rounded bg-raise px-1.5 py-0.5">{mq.date}</span>}<span className="text-dim">↵ logs it to your budget</span></div></div>);
  const effDue = parsed?.due ?? (parsed?.due_time || parsed?.repeat ? today : null);
  const due = effDue ? (effDue === today ? "Today" : nice(effDue)) : null;
  if (parsed?.title) return (
    <div className="space-y-2">
      <div className="text-[15px] font-medium">{parsed.title}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-mute">
        {due && <span className="inline-flex items-center gap-1 rounded bg-warn/10 px-1.5 py-0.5 font-medium text-warn"><Icon name="calendar" size={12} />{due}{parsed?.due_time && <span className="font-normal"> · {fmtTime(parsed.due_time)}</span>}</span>}
        {parsed?.estimate ? <span className="inline-flex items-center gap-1 rounded bg-raise px-1.5 py-0.5"><Icon name="clock" size={12} />{fmtMinutes(parsed.estimate)}</span> : null}
        {parsed.repeat && <span className="inline-flex items-center gap-1 rounded bg-raise px-1.5 py-0.5"><Icon name="repeat" size={12} />{describeRepeat(parsed.repeat)}</span>}
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

export type MoneyCtx = { cats: string[]; currency: string } | null;
export function CaptureForm({ today, variant, onDone, money }: { today: string; variant: "pill" | "sheet"; onDone?: () => void; money?: MoneyCtx }) {
  const [v, setV] = useState(""), [focus, setFocus] = useState(false), [ok, setOk] = useState(false);
  const { guarded } = useSession(), dk = `capture:${variant}`;
  useEffect(() => { const d = getDraft<string>(dk); if (d?.value?.trim()) setV(d.value); }, [dk]);
  useEffect(() => { if (v.trim()) { try { localStorage.setItem(`lifeos:draft:${dk}`, JSON.stringify({ value: v, at: Date.now() })); } catch { /* ignore */ } } else dropDraft(dk); }, [v, dk]);
  const pid = usePathname().match(/^\/projects\/(\d+)/)?.[1];
  const parsed = useMemo(() => { if (!v.trim()) return null; try { return parseQuickAdd(v, today); } catch { return null; } }, [v, today]);
  const sheet = variant === "sheet";
  const mq = money ? parseMoneyQuick(v, today, money.cats) : null;
  const action = async (fd: FormData) => {
    if (!mq && !parsed?.title) return;
    const g = await guarded(`capture-save:${dk}`, v, async () => { if (mq) await quickSpend(v); else await quickAdd(fd); });
    if (!g.saved) return; // text stays in the box (and in local storage) until it really saved
    setV(""); setOk(true); setTimeout(() => setOk(false), 1800); onDone?.();
  };

  return (
    <form className="relative" action={action}>
      {pid && <input type="hidden" name="project_id" value={pid} />}
      <div className={`flex items-center gap-2 transition ${sheet ? "rounded-xl border bg-panel px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25" : "rounded-full bg-raise px-3.5 hover:bg-raise/70 focus-within:bg-panel focus-within:shadow-[0_0_0_2px_rgb(var(--accent)/0.5)]"}`}>
        <Icon name={ok ? "check" : "plus"} size={16} className={ok ? "text-ok" : "text-mute"} />
        <input id={sheet ? undefined : "capture"} name="text" value={v} onChange={(e) => setV(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} autoFocus={sheet}
          autoComplete="off" enterKeyHint="done" placeholder={ok ? "Added!" : "Add a task…  e.g. Call mum friday #family"} className={`min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-mute ${sheet ? "py-3 text-base" : "py-2"}`} />
        <Mic onText={(t) => { setV((x) => (x ? x + " " : "") + t); }} />
        {!sheet && !v && <kbd className="hidden rounded border bg-panel px-1.5 text-[11px] text-dim lg:block">C</kbd>}
      </div>
      {sheet ? (
        <div className="mt-3 min-h-14"><Preview v={v} parsed={parsed} today={today} empty={!v} mq={mq} cur={money?.currency} /></div>
      ) : (
        focus && (parsed?.title || mq || !v) && <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl border bg-panel p-3.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)]"><Preview v={v} parsed={parsed} today={today} empty={!v} mq={mq} cur={money?.currency} /></div>
      )}
      {sheet && <button className="btn-primary mt-3 !h-11 w-full !text-[15px]" disabled={!parsed?.title && !mq}>Add task</button>}
    </form>
  );
}

export function CaptureFab({ today, money }: { today: string; money?: MoneyCtx }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const f = () => setOpen(true); window.addEventListener("lifeos:capture", f); return () => window.removeEventListener("lifeos:capture", f); }, []);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="New task" className="fab fixed bottom-[76px] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-accent text-ink shadow-[0_6px_18px_rgb(24_119_242/0.45)] transition active:scale-95 md:hidden"><Icon name="plus" size={26} /></button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 md:hidden" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full rounded-t-2xl bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fg/15" />
            <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">New task</h2><button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 text-mute hover:bg-raise"><Icon name="x" size={18} /></button></div>
            <CaptureForm today={today} variant="sheet" onDone={() => setOpen(false)} money={money} />
          </div>
        </div>
      )}
    </>
  );
}

/** Voice capture via the browser's built-in speech recognition. Hidden where it isn't supported (e.g. Firefox). */
function Mic({ onText }: { onText: (t: string) => void }) {
  const [on, setOn] = useState(false), [can, setCan] = useState(false);
  useEffect(() => { setCan(typeof window !== "undefined" && !!((window as never as Record<string, unknown>).SpeechRecognition || (window as never as Record<string, unknown>).webkitSpeechRecognition)); }, []);
  if (!can) return null;
  const start = () => {
    const W = window as never as Record<string, new () => { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void }>;
    const R = W.SpeechRecognition || W.webkitSpeechRecognition, r = new R(); r.lang = navigator.language || "en-NZ"; r.interimResults = false;
    r.onresult = (e) => { const t = Array.from(e.results).map((x) => x[0].transcript).join(" ").trim(); if (t) onText(t); }; r.onend = () => setOn(false); r.onerror = () => setOn(false);
    setOn(true); r.start();
  };
  return <button type="button" onClick={start} disabled={on} aria-label="Dictate a task" title="Dictate" className={`rounded-full p-1 ${on ? "animate-pulse text-danger" : "text-mute hover:text-fg"}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></button>;
}
