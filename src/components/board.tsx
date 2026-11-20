"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTaskInline, moveTask, restoreTaskAction } from "@/lib/actions";
import { TaskLightbox } from "./lightbox";
import { addCardAction, bulkBoardAction, moveCardAction, type BulkOp } from "@/lib/actions5";
import { fmtMinutes, nice } from "@/lib/dates";
import { issueKey } from "@/lib/ui";
import { StatusIcon } from "./StatusIcon";
import { Icon } from "./Icon";
import { Pill } from "./Pill";

type Kind = "todo" | "doing" | "done";
export type Column = { id: number; key: string; name: string; kind: Kind };
export type Card = { id: number; title: string; status: string; priority: number; due: string | null; project_name: string | null; project_color: string | null; tags: string[]; repeat: string | null; estimate?: number | null; sub_total?: number; sub_done?: number };
const lift = "shadow-[0_1px_1px_rgb(9_30_66/0.25),0_0_1px_rgb(9_30_66/0.31)] dark:shadow-none dark:border";

export function Board({ columns, cards, today, projectId = null, hiddenNote, toolbar }: { columns: Column[]; cards: Card[]; today: string; projectId?: number | null; hiddenNote?: React.ReactNode; toolbar?: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useOptimistic(cards, (s, a: { id: number; status: string; before?: number | null }) => { const c = s.find((x) => x.id === a.id); if (!c) return s; const rest = s.filter((x) => x.id !== a.id), at = a.before ? rest.findIndex((x) => x.id === a.before) : -1; const moved = { ...c, status: a.status }; return at < 0 ? [...rest, moved] : [...rest.slice(0, at), moved, ...rest.slice(at)]; });
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null), [selecting, setSelecting] = useState(false), [sel, setSel] = useState<Set<number>>(new Set()), [active, setActive] = useState(0), track = useRef<HTMLDivElement>(null);
  const step = () => { const el = track.current, first = el?.children[0] as HTMLElement | undefined; return first ? first.offsetWidth + 10 : 0; }; // a column plus the gap
  const onScroll = () => { const el = track.current, w = step(); if (el && w && window.matchMedia("(max-width: 767px)").matches) setActive(Math.max(0, Math.min(columns.length - 1, Math.round(el.scrollLeft / w)))); };
  const goTo = (i: number) => { setActive(i); track.current?.scrollTo({ left: i * step(), behavior: "smooth" }); };
  const shownCol = columns[Math.min(active, columns.length - 1)]?.key;
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const bulk = (o: BulkOp) => start(async () => { const r = await bulkBoardAction([...sel], o); toast(r.ok ? (r.message ?? "Done") : r.error); if (r.ok && o.op === "delete") { setSel(new Set()); setSelecting(false); } }); // other changes keep the selection, so you can apply several in a row
  const kindOf = (key: string): Kind => columns.find((c) => c.key === key)?.kind ?? "todo";
  const move = (id: number, status: string) => start(async () => { const rep = items.find((x) => x.id === id)?.repeat; setItems({ id, status: rep && kindOf(status) === "done" ? columns[0].key : status }); const r = await moveTask(id, status); if (!r.ok) toast(r.error ?? "Couldn't move that card"); });
  /** Drop `id` into `status`, just before card `before` (or at the end), keeping the column's manual order. */
  const place = (id: number, status: string, before: number | null) => start(async () => {
    setItems({ id, status, before });
    const col = items.filter((c) => c.status === status && c.id !== id).map((c) => c.id), at = before ? col.indexOf(before) : -1; col.splice(at < 0 ? col.length : at, 0, id);
    const r = await moveCardAction(id, status, col); if (!r.ok) toast(r.error);
  });
  // The whole card opens the task (not just the title). Buttons and links inside keep their own behaviour; a drag never counts as a click.
  const [lightbox, setLightbox] = useState<number | null>(null), [tools, setTools] = useState(false);
  const open = (e: React.MouseEvent | React.KeyboardEvent, id: number) => { if ((e.target as HTMLElement).closest("button, a, input")) return; if (selecting) { toggle(id); return; } setLightbox(id); };
  const closeLightbox = () => { setLightbox(null); router.refresh(); };
  /** Tick a card: it moves to the first Done column; ticking a finished one puts it back in the first To do column. */
  const complete = (c: Card) => { const toDone = kindOf(c.status) !== "done", dest = columns.find((x) => x.kind === (toDone ? "done" : "todo")) ?? columns[0]; if (dest) move(c.id, dest.key); };
  const remove = (c: Card) => start(async () => { const r = await deleteTaskInline(c.id); if (r) toast(`Deleted “${r.title}”`, { action: { label: "Undo", onClick: () => void restoreTaskAction(c.id).then(() => router.refresh()) } }); else toast("Couldn't delete that"); router.refresh(); });

  return (
    <>
    {lightbox !== null && <TaskLightbox id={lightbox} onClose={closeLightbox} />}
    <div role="tablist" aria-label="Columns" className="sticky top-12 z-10 -mx-4 mb-2 flex gap-1.5 overflow-x-auto bg-bg/95 px-4 py-1.5 backdrop-blur md:hidden">{columns.map((c) => <button key={c.key} role="tab" aria-selected={shownCol === c.key} onClick={() => goTo(columns.findIndex((x) => x.key === c.key))} className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${shownCol === c.key ? "border-accent/50 bg-accent/10 font-medium text-accent" : "text-mute"}`}>{c.name} <span className="text-dim">{items.filter((x) => x.status === c.key).length}</span></button>)}</div>
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <button type="button" aria-expanded={tools} onClick={() => setTools((v) => !v)} className={`btn !h-8 text-xs md:hidden ${tools ? "!border-accent/40 !bg-accent/10 !text-accent" : ""}`}><Icon name="search" size={13} />Filters</button>
      <div className={`${tools ? "flex" : "hidden"} w-full flex-wrap items-center gap-x-3 gap-y-2 md:order-none md:flex md:w-auto`}>{toolbar}</div>
      <div className="ml-auto flex items-center gap-2">
        {selecting && <span className="text-xs text-mute">{sel.size} selected</span>}
        <button className={selecting ? "btn-primary !h-8 text-xs" : "btn !h-8 text-xs"} onClick={() => { setSelecting((v) => !v); setSel(new Set()); }}>{selecting ? "Done" : "Select"}</button>
      </div>
    </div>
    <div ref={track} onScroll={onScroll} className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 items-start gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-3 md:-mx-8 md:snap-none md:px-8">
      {columns.map((col, ci) => {
        const list = items.filter((c) => c.status === col.key);
        return (
          <section key={col.key} onDragOver={(e) => { e.preventDefault(); setOver(col.key); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = Number(e.dataTransfer.getData("text/plain")); if (id) place(id, col.key, null); }}
            className={`rise w-full shrink-0 snap-start rounded-xl bg-raise/60 p-1.5 transition md:block md:min-h-[calc(100dvh-17rem)] md:w-auto md:min-w-[272px] md:max-w-[480px] md:flex-1 ${over === col.key ? "ring-2 ring-accent/50" : ""}`} style={{ ["--i" as string]: ci }}>
            <h2 className="flex items-center gap-1.5 px-1.5 pb-1.5 pt-1 text-[12px] font-semibold text-mute"><StatusIcon status={col.kind} size={12} /><span className="truncate">{col.name}</span><span className="font-medium text-dim">{list.length}</span>{col.kind !== "done" && list.some((c) => c.estimate) && <span className="ml-auto font-normal text-dim" title="Estimated time in this column">{fmtMinutes(list.reduce((n, c) => n + (c.estimate ?? 0), 0))}</span>}</h2>
            <ul className="space-y-1.5">
              {list.map((c) => {
                const done = col.kind === "done";
                const d = c.due && !done ? (c.due < today ? "text-danger" : c.due === today ? "text-ok" : "text-mute") : "text-mute";
                return (
                  <li key={c.id} data-ctx-task={c.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(c.id)); e.dataTransfer.setData("application/x-lifeos-task", String(c.id)); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(null); const id = Number(e.dataTransfer.getData("text/plain")); if (!id || id === c.id) return; const r = e.currentTarget.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2, i = list.findIndex((x) => x.id === c.id), next = after ? list[i + 1]?.id ?? null : c.id; place(id, col.key, next); }} onClick={(e) => open(e, c.id)} onKeyDown={(e) => { if (e.key === "Enter") open(e, c.id); }} tabIndex={0} role="link" aria-label={`Open ${c.title}`}
                    title={issueKey(c.project_name, c.id)}
                    className={`group relative cursor-pointer rounded-lg bg-panel px-2.5 py-2 ${c.priority > 0 && !done ? "border-l-[3px] border-l-danger" : ""} outline-none transition hover:bg-raise/40 focus-visible:ring-2 focus-visible:ring-accent/50 active:cursor-grabbing ${lift}`}>
                    {selecting && <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.title}`} className="absolute left-2.5 top-2.5 h-4 w-4" />}
                    <div className={`flex items-start gap-2 ${selecting ? "pl-6" : ""} pr-12`}>
                      {!selecting && <button type="button" aria-label={done ? `Reopen ${c.title}` : `Complete ${c.title}`} title={done ? "Reopen" : "Mark done"} onClick={() => complete(c)} className={`mt-[2px] grid h-[16px] w-[16px] shrink-0 place-items-center rounded-full border-[1.5px] transition ${done ? "border-ok bg-ok text-white" : "border-fg/35 text-transparent hover:border-ok hover:text-ok"}`}><Icon name="check" size={10} /></button>}
                      <Link href={`/tasks/${c.id}`} draggable={false} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); if (selecting) toggle(c.id); else setLightbox(c.id); }} className={`block text-[13.5px] leading-snug ${done ? "text-dim line-through" : ""}`}>{c.title}</Link></div>
                    {(c.tags.length > 0 || !!c.sub_total || c.repeat || c.due || c.priority !== 0 || !!c.estimate || (projectId === null && !!c.project_name)) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[24px] text-[11px] text-mute">
                        {projectId === null && c.project_name && <span className="inline-flex items-center gap-1" title="Project"><span className="h-2 w-2 rounded-full" style={{ background: c.project_color ?? "currentColor" }} />{c.project_name}</span>}{c.tags.map((g) => <Pill key={g} name={g} />)}
                        {!!c.sub_total && <span className="inline-flex items-center gap-1" title={`${c.sub_done ?? 0} of ${c.sub_total} subtasks done`}><Icon name="list" size={11} />{c.sub_done ?? 0}/{c.sub_total}</span>}
                        {!!c.estimate && <span className="inline-flex items-center gap-1"><Icon name="clock" size={11} />{fmtMinutes(c.estimate)}</span>}{c.repeat && <Icon name="repeat" size={12} />}
                        {c.due && <span className={`inline-flex items-center gap-1 ${d}`}><Icon name="calendar" size={11} />{c.due === today ? "Today" : nice(c.due).split(", ")[1]}</span>}
                        {c.priority > 0 && <Icon name="chevUp2" size={13} className="text-danger" />}{c.priority < 0 && <Icon name="chevDown1" size={13} className="text-accent" />}
                      </div>)}
                    <div className="absolute right-1 top-1 flex text-mute [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                      <button onClick={() => setLightbox(c.id)} aria-label={`Open ${c.title}`} title="Open" className="grid h-5 w-5 place-items-center rounded hover:bg-raise hover:text-fg"><Icon name="ext" size={12} /></button>
                      <button onClick={() => remove(c)} aria-label={`Delete ${c.title}`} title="Delete" className="grid h-5 w-5 place-items-center rounded hover:bg-raise hover:text-danger"><Icon name="trash" size={12} /></button>
                    </div>
                  </li>
                );
              })}
              {!list.length && <li className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-dim">{col.kind === "done" ? "Finished tasks land here" : "Drop a card here"}</li>}
            </ul>
            {col.kind === "done" && hiddenNote}
            <AddCard column={col} projectId={projectId} />
          </section>
        );
      })}
    </div>
    {selecting && sel.size > 0 && (
      <div className="sticky bottom-20 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-panel p-2 shadow-[0_8px_30px_rgb(0_0_0/0.15)] md:bottom-4">
        <span className="px-1 text-xs font-medium">{sel.size} selected</span>
        <select aria-label="Move selected to" defaultValue="" onChange={(e) => { if (e.target.value) { bulk({ op: "move", column: e.target.value }); e.target.value = ""; } }} className="field !w-auto !py-1 text-[13px]"><option value="">Move to…</option>{columns.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
        <select aria-label="Set priority of selected" defaultValue="" onChange={(e) => { if (e.target.value !== "") { bulk({ op: "priority", value: Number(e.target.value) as -1 | 0 | 1 }); e.target.value = ""; } }} className="field !w-auto !py-1 text-[13px]"><option value="">Priority…</option><option value="1">High</option><option value="0">Normal</option><option value="-1">Low</option></select>
        <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget, v = (f.elements.namedItem("tag") as HTMLInputElement).value.trim(); if (v) { bulk({ op: "tag", tag: v }); f.reset(); } }}><input name="tag" placeholder="Add tag" aria-label="Add tag to selected" className="field !w-28 !py-1 text-[13px]" /><button className="btn !h-8 text-xs">Add</button></form>
        <button className="btn !h-8 text-xs text-danger" onClick={() => { if (confirm(`Delete ${sel.size} card${sel.size === 1 ? "" : "s"}? You can restore them from Trash.`)) bulk({ op: "delete" }); }}>Delete</button>
        <button className="text-xs text-mute hover:text-fg" onClick={() => setSel(new Set())}>Clear</button>
      </div>)}
    </>
  );
}

/** "+ Add card" at the bottom of a column. Enter adds and keeps the box open for the next one. */
function AddCard({ column, projectId }: { column: Column; projectId: number | null }) {
  const [open, setOpen] = useState(false), [text, setText] = useState(""), [busy, start] = useTransition();
  const submit = () => { const t = text.trim(); if (!t) return; start(async () => { const r = await addCardAction(t, column.key, projectId); if (r.ok) setText(""); else toast(r.error); }); };
  if (!open) return <button onClick={() => setOpen(true)} className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-mute hover:bg-panel/70 hover:text-fg"><Icon name="plus" size={14} />Add card</button>;
  return (
    <div className="mt-2 rounded-lg bg-panel p-2 shadow-sm">
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Title (try: Call vet friday #pets !high)" aria-label={`New card in ${column.name}`} disabled={busy}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") { setOpen(false); setText(""); } }} className="field resize-none text-[14px]" />
      <div className="mt-1.5 flex items-center gap-2"><button className="btn-primary !h-7 text-xs" disabled={busy || !text.trim()} onClick={submit}>Add</button><button className="text-xs text-mute hover:text-fg" onClick={() => { setOpen(false); setText(""); }}>Close</button></div>
    </div>
  );
}
