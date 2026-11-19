"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { moveTask } from "@/lib/actions";
import { addCardAction } from "@/lib/actions5";
import { nice } from "@/lib/dates";
import { issueKey } from "@/lib/ui";
import { StatusIcon } from "./StatusIcon";
import { Icon } from "./Icon";
import { Pill } from "./Pill";

type Kind = "todo" | "doing" | "done";
export type Column = { id: number; key: string; name: string; kind: Kind };
export type Card = { id: number; title: string; status: string; priority: number; due: string | null; project_name: string | null; project_color: string | null; tags: string[]; repeat: string | null };
const lift = "shadow-[0_1px_1px_rgb(9_30_66/0.25),0_0_1px_rgb(9_30_66/0.31)] dark:shadow-none dark:border";

export function Board({ columns, cards, today, projectId = null, hiddenNote }: { columns: Column[]; cards: Card[]; today: string; projectId?: number | null; hiddenNote?: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useOptimistic(cards, (s, a: { id: number; status: string }) => s.map((c) => (c.id === a.id ? { ...c, status: a.status } : c)));
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const kindOf = (key: string): Kind => columns.find((c) => c.key === key)?.kind ?? "todo";
  const move = (id: number, status: string) => start(async () => { setItems({ id, status }); const r = await moveTask(id, status); if (!r.ok) toast(r.error ?? "Couldn't move that card"); });
  // The whole card opens the task (not just the title). Buttons and links inside keep their own behaviour; a drag never counts as a click.
  const open = (e: React.MouseEvent | React.KeyboardEvent, id: number) => { if ((e.target as HTMLElement).closest("button, a")) return; router.push(`/tasks/${id}`); };

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:-mx-10 md:grid md:snap-none md:px-10 md:[grid-template-columns:repeat(var(--cols),minmax(220px,1fr))]" style={{ ["--cols" as string]: columns.length }}>
      {columns.map((col, ci) => {
        const list = items.filter((c) => c.status === col.key);
        return (
          <section key={col.key} onDragOver={(e) => { e.preventDefault(); setOver(col.key); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = Number(e.dataTransfer.getData("text/plain")); if (id) move(id, col.key); }}
            className={`rise min-h-[60vh] w-[84%] shrink-0 snap-center rounded-xl bg-raise/70 p-2 transition md:w-auto ${over === col.key ? "ring-2 ring-accent/50" : ""}`} style={{ ["--i" as string]: ci }}>
            <h2 className="flex items-center gap-2 px-2 pb-2.5 pt-1.5 text-xs font-semibold uppercase tracking-wide text-mute"><StatusIcon status={col.kind} size={13} /><span className="truncate">{col.name}</span><span className="font-medium text-dim">{list.length}</span></h2>
            <ul className="space-y-2">
              {list.map((c) => {
                const done = col.kind === "done";
                const d = c.due && !done ? (c.due < today ? "text-danger" : c.due === today ? "text-ok" : "text-mute") : "text-mute";
                return (
                  <li key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", String(c.id))} onClick={(e) => open(e, c.id)} onKeyDown={(e) => { if (e.key === "Enter") open(e, c.id); }} tabIndex={0} role="link" aria-label={`Open ${c.title}`}
                    className={`group relative cursor-pointer rounded-lg bg-panel p-3 outline-none transition hover:bg-raise/40 focus-visible:ring-2 focus-visible:ring-accent/50 active:cursor-grabbing ${lift}`}>
                    <Link href={`/tasks/${c.id}`} draggable={false} className={`block pr-12 text-[14px] leading-snug ${done ? "text-dim line-through" : ""}`}>{c.title}</Link>
                    {c.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{c.tags.map((g) => <Pill key={g} name={g} />)}</div>}
                    <div className="mt-3 flex items-center gap-2 text-xs text-mute">
                      <StatusIcon status={kindOf(c.status)} size={15} />
                      <span className={`font-medium ${done ? "line-through" : ""}`}>{issueKey(c.project_name, c.id)}</span>
                      <span className="ml-auto flex items-center gap-2">
                        {c.repeat && <Icon name="repeat" size={13} />}
                        {c.due && <span className={`inline-flex items-center gap-1 ${d}`}><Icon name="calendar" size={12} />{c.due === today ? "Today" : nice(c.due).split(", ")[1]}</span>}
                        {c.priority > 0 && <Icon name="chevUp2" size={15} className="text-danger" />}{c.priority < 0 && <Icon name="chevDown1" size={15} className="text-accent" />}
                      </span>
                    </div>
                    <div className="absolute right-1.5 top-1.5 flex text-mute [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100">
                      <button disabled={ci === 0} onClick={() => move(c.id, columns[ci - 1].key)} aria-label={`Move to ${columns[ci - 1]?.name}`} className="grid h-6 w-6 place-items-center rounded hover:bg-raise disabled:invisible"><Icon name="chevRight" size={14} className="rotate-180" /></button>
                      <button disabled={ci === columns.length - 1} onClick={() => move(c.id, columns[ci + 1].key)} aria-label={`Move to ${columns[ci + 1]?.name}`} className="grid h-6 w-6 place-items-center rounded hover:bg-raise disabled:invisible"><Icon name="chevRight" size={14} /></button>
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
