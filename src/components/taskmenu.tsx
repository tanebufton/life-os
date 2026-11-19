"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteTaskInline, patchTask, restoreTaskAction, toggleTask } from "@/lib/actions";
import { moveTaskToProjectAction } from "@/lib/actions5";
import { addDays } from "@/lib/dates";
import { Icon } from "./Icon";

type Proj = { id: number; name: string; color: string };
/** Right-click any task (a list row or a board card) for the common changes, without opening it. */
export function TaskMenu({ today, projects }: { today: string; projects: Proj[] }) {
  const router = useRouter(), [m, setM] = useState<{ id: number; x: number; y: number } | null>(null), [sub, setSub] = useState<null | "move">(null), ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctx = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-task-id], [data-ctx-task]") as HTMLElement | null;
      if (!el || (e.target as HTMLElement).closest("input, textarea, select, a[href^='http']")) return;
      const id = Number(el.dataset.taskId ?? el.dataset.ctxTask); if (!id) return;
      e.preventDefault(); setSub(null); setM({ id, x: Math.min(e.clientX, innerWidth - 232), y: Math.min(e.clientY, innerHeight - 330) });
    };
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setM(null); };
    document.addEventListener("contextmenu", ctx); document.addEventListener("mousedown", close); document.addEventListener("keydown", close); window.addEventListener("scroll", () => setM(null), true);
    return () => { document.removeEventListener("contextmenu", ctx); document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, []);
  if (!m) return null;
  const run = async (f: () => Promise<unknown>) => { setM(null); await f(); router.refresh(); };
  const set = (patch: object) => run(async () => { const r = await patchTask(m.id, patch); if (!r.ok) toast(r.error); });
  const it = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-raise";
  const head = "px-2.5 pb-0.5 pt-2 text-[11px] font-semibold text-dim";
  return (
    <div ref={ref} role="menu" aria-label="Task actions" style={{ left: m.x, top: m.y }} className="fixed z-[60] w-56 rounded-xl border bg-panel p-1 shadow-[0_8px_30px_rgb(0_0_0/0.18)]">
      {sub === "move" ? <div className="max-h-72 overflow-y-auto">
        <button className={`${it} text-mute`} onClick={() => setSub(null)}><Icon name="chevRight" size={13} className="rotate-180" />Back</button>
        <button className={it} onClick={() => run(() => moveTaskToProjectAction(m.id, null))}><Icon name="inbox" size={14} className="text-mute" />No project</button>
        {projects.map((p) => <button key={p.id} className={it} onClick={() => run(() => moveTaskToProjectAction(m.id, p.id))}><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.name}</button>)}
      </div> : <>
        <button role="menuitem" className={it} onClick={() => run(async () => { const r = await toggleTask(m.id); if (r) toast(r.done ? (r.next_due ? `Done. Next one is ${r.next_due}` : "Done") : "Reopened", { description: r.title }); })}><Icon name="check" size={14} className="text-ok" />Complete / reopen</button>
        <button role="menuitem" className={it} onClick={() => { setM(null); router.push(`/tasks/${m.id}`); }}><Icon name="ext" size={14} className="text-mute" />Open</button>
        <div className={head}>Date</div>
        <div className="flex flex-wrap gap-1 px-1.5 pb-1">
          {([["Today", 0], ["Tomorrow", 1], ["Next week", 7]] as const).map(([l, n]) => <button key={l} role="menuitem" onClick={() => set({ due: addDays(today, n) })} className="rounded-full border px-2.5 py-1 text-[12px] hover:bg-raise">{l}</button>)}
          <button role="menuitem" onClick={() => set({ due: null, due_time: null })} className="rounded-full px-2.5 py-1 text-[12px] text-mute hover:bg-raise">No date</button>
        </div>
        <div className={head}>Priority</div>
        <div className="flex gap-1 px-1.5 pb-1">{([["High", 1], ["Normal", 0], ["Low", -1]] as const).map(([l, n]) => <button key={l} role="menuitem" onClick={() => set({ priority: n })} className="rounded-full border px-2.5 py-1 text-[12px] hover:bg-raise">{l}</button>)}</div>
        <div className="my-1 border-t" />
        <button role="menuitem" className={it} onClick={() => setSub("move")}><Icon name="list" size={14} className="text-mute" />Move to project<Icon name="chevRight" size={13} className="ml-auto text-dim" /></button>
        <button role="menuitem" className={it} onClick={() => { const id = m.id; setM(null); void navigator.clipboard.writeText(`${location.origin}/tasks/${id}`).then(() => toast("Link copied")); }}><Icon name="link" size={14} className="text-mute" />Copy link</button>
        <button role="menuitem" className={`${it} text-danger`} onClick={() => { const id = m.id; void run(async () => { const r = await deleteTaskInline(id); if (r) toast(`Deleted “${r.title}”`, { action: { label: "Undo", onClick: () => void restoreTaskAction(id).then(() => router.refresh()) } }); }); }}><Icon name="trash" size={14} />Delete</button>
      </>}
    </div>
  );
}
