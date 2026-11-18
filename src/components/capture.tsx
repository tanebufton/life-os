"use client";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { quickAdd } from "@/lib/actions";
import { nice } from "@/lib/dates";
import { describeRepeat, parseQuickAdd } from "@/lib/parse";
import { Icon } from "./Icon";
import { Pill } from "./Pill";

const SYNTAX: [string, string][] = [["#tag", "label it"], ["@project", "file it in a project"], ["!high  !low  !doing", "priority or status"], ["tomorrow · friday · in 3 days", "due date"], ["daily · weekdays · every 2 weeks", "repeat"]];

function Preview({ v, parsed, today, empty }: { v: string; parsed: ReturnType<typeof parseQuickAdd> | null; today: string; empty: boolean }) {
  const due = parsed?.due ? (parsed.due === today ? "Today" : nice(parsed.due)) : null;
  if (parsed?.title) return (
    <div className="space-y-2">
      <div className="text-[15px] font-medium">{parsed.title}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-mute">
        {due && <span className="inline-flex items-center gap-1 rounded bg-warn/10 px-1.5 py-0.5 font-medium text-warn"><Icon name="calendar" size={12} />{due}</span>}
        {parsed.repeat && <span className="inline-flex items-center gap-1 rounded bg-raise px-1.5 py-0.5"><Icon name="repeat" size={12} />{describeRepeat(parsed.repeat)}</span>}
        {parsed.project && <span className="rounded bg-raise px-1.5 py-0.5 font-medium text-fg">{parsed.project}</span>}
        {parsed.tags?.map((t) => <Pill key={t} name={t} />)}
        {parsed.priority === 1 && <span className="inline-flex items-center gap-0.5 rounded bg-danger/10 px-1.5 py-0.5 font-medium text-danger"><Icon name="chevUp2" size={12} />High</span>}
        {parsed.priority === -1 && <span className="rounded bg-raise px-1.5 py-0.5">Low priority</span>}
        {parsed.status === "doing" && <span className="lozenge bg-accent/15 text-accent">In progress</span>}
        {!due && !parsed.repeat && !parsed.project && !parsed.tags && <span className="inline-flex items-center gap-1"><Icon name="inbox" size={12} />Goes to your inbox</span>}
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
  const pid = usePathname().match(/^\/projects\/(\d+)/)?.[1];
  const parsed = useMemo(() => { if (!v.trim()) return null; try { return parseQuickAdd(v, today); } catch { return null; } }, [v, today]);
  const sheet = variant === "sheet";
  const action = async (fd: FormData) => { if (!parsed?.title) return; await quickAdd(fd); setV(""); setOk(true); setTimeout(() => setOk(false), 1800); onDone?.(); };

  return (
    <form className="relative" action={action}>
      {pid && <input type="hidden" name="project_id" value={pid} />}
      <div className={`flex items-center gap-2 transition ${sheet ? "rounded-xl border bg-panel px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25" : "rounded-full bg-raise px-3.5 hover:bg-raise/70 focus-within:bg-panel focus-within:shadow-[0_0_0_2px_rgb(var(--accent)/0.5)]"}`}>
        <Icon name={ok ? "check" : "plus"} size={16} className={ok ? "text-ok" : "text-mute"} />
        <input id={sheet ? undefined : "capture"} name="text" value={v} onChange={(e) => setV(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} autoFocus={sheet}
          autoComplete="off" enterKeyHint="done" placeholder={ok ? "Added!" : "Add a task…  e.g. Call mum friday #family"} className={`min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-mute ${sheet ? "py-3 text-base" : "py-2"}`} />
        {!sheet && !v && <kbd className="hidden rounded border bg-panel px-1.5 text-[11px] text-dim lg:block">C</kbd>}
      </div>
      {sheet ? (
        <div className="mt-3 min-h-14"><Preview v={v} parsed={parsed} today={today} empty={!v} /></div>
      ) : (
        focus && (parsed?.title || !v) && <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl border bg-panel p-3.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)]"><Preview v={v} parsed={parsed} today={today} empty={!v} /></div>
      )}
      {sheet && <button className="btn-primary mt-3 !h-11 w-full !text-[15px]" disabled={!parsed?.title}>Add task</button>}
    </form>
  );
}

export function CaptureFab({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const f = () => setOpen(true); window.addEventListener("lifeos:capture", f); return () => window.removeEventListener("lifeos:capture", f); }, []);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="New task" className="fixed bottom-[76px] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-accent text-ink shadow-[0_6px_18px_rgb(24_119_242/0.45)] transition active:scale-95 md:hidden"><Icon name="plus" size={26} /></button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 md:hidden" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full rounded-t-2xl bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fg/15" />
            <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">New task</h2><button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 text-mute hover:bg-raise"><Icon name="x" size={18} /></button></div>
            <CaptureForm today={today} variant="sheet" onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
