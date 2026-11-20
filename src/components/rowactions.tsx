"use client";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { deleteTaskInline, duplicateTaskAction, rescheduleAction, restoreTaskAction, startFocus } from "@/lib/actions";
import { Icon } from "./Icon";

const item = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-raise";
export function RowActions({ id, due, focus }: { id: number; due: string | null; focus: boolean }) {
  const [open, setOpen] = useState<null | "date" | "more">(null);
  const box = useRef<HTMLSpanElement>(null), menu = useRef<HTMLDivElement>(null), router = useRouter();
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  // The menu lives in a portal so no card/section (overflow, stacking context) can clip or cover it.
  useLayoutEffect(() => {
    if (!open || !box.current) return;
    const r = box.current.getBoundingClientRect(), below = window.innerHeight - r.bottom;
    setPos({ right: Math.max(8, window.innerWidth - r.right), ...(below < 280 && r.top > below ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const d = (e: MouseEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !menu.current?.contains(t)) setOpen(null); }, k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null), close = () => setOpen(null);
    document.addEventListener("mousedown", d); document.addEventListener("keydown", k); window.addEventListener("resize", close); document.addEventListener("scroll", close, true);
    return () => { document.removeEventListener("mousedown", d); document.removeEventListener("keydown", k); window.removeEventListener("resize", close); document.removeEventListener("scroll", close, true); };
  }, [open]);
  const when = async (to: string, label: string) => { setOpen(null); await rescheduleAction(id, to); toast(label); };
  const del = async () => { setOpen(null); const r = await deleteTaskInline(id); if (r) toast(`Deleted “${r.title}”`, { action: { label: "Undo", onClick: () => void restoreTaskAction(id) } }); };
  const btn = "grid h-7 w-7 place-items-center rounded-md text-mute hover:bg-raise hover:text-fg";
  return (
    <span ref={box} className="flex shrink-0 items-center [@media(hover:hover)]:absolute [@media(hover:hover)]:right-1.5 [@media(hover:hover)]:top-1.5 [@media(hover:hover)]:rounded-md [@media(hover:hover)]:bg-raise [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:shadow-sm [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
      <button onClick={() => setOpen(open === "date" ? null : "date")} aria-label="Reschedule" className={`${btn} hidden sm:grid`}><Icon name="calendar" size={15} /></button>
      <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); window.dispatchEvent(new CustomEvent("lifeos:taskmenu", { detail: { id, x: r.right, y: r.bottom + 4, focus } })); }} aria-label="More actions" className={btn}><Icon name="more" size={16} /></button>
      {open && pos && createPortal(
        <div ref={menu} style={{ position: "fixed", ...pos }} className="z-[60] w-52 rounded-xl border bg-panel p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.18)]">
          {open === "date" ? (<>
            <button className={item} onClick={() => when("today", "Moved to today")}><Icon name="calendar" size={15} className="text-ok" />Today</button>
            <button className={item} onClick={() => when("tomorrow", "Moved to tomorrow")}><Icon name="sunrise" size={15} className="text-warn" />Tomorrow</button>
            <button className={item} onClick={() => when("weekend", "Moved to the weekend")}><Icon name="upcoming" size={15} className="text-accent" />This weekend</button>
            <button className={item} onClick={() => when("nextweek", "Moved to next week")}><Icon name="arrow" size={15} className="text-mute" />Next week</button>
            {due && <button className={item} onClick={() => when("none", "Date removed")}><Icon name="x" size={15} className="text-mute" />No date</button>}
            <label className="mt-1 block border-t px-2.5 pb-1 pt-2 text-xs text-mute">Pick a date<input type="date" onChange={(e) => e.target.value && when(e.target.value, "Rescheduled")} className="field mt-1 !py-1" /></label>
          </>) : (<>
            <button className={item} onClick={() => { setOpen(null); router.push(`/tasks/${id}`); }}><Icon name="ext" size={15} className="text-mute" />Open</button>
            {focus && <button className={item} onClick={async () => { setOpen(null); await startFocus(id); router.push(`/focus?task=${id}`); }}><Icon name="focus" size={15} className="text-accent" />Start focus</button>}
            <button className={item} onClick={async () => { setOpen(null); const n = await duplicateTaskAction(id); if (n) toast("Task duplicated", { action: { label: "Open", onClick: () => router.push(`/tasks/${n}`) } }); }}><Icon name="copy" size={15} className="text-mute" />Duplicate</button>
            <button className={`${item} text-danger`} onClick={del}><Icon name="trash" size={15} />Delete</button>
          </>)}
        </div>, document.body)}
    </span>
  );
}
