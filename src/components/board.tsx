"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveTask } from "@/lib/actions";
import { nice } from "@/lib/dates";
import { issueKey } from "@/lib/ui";
import { StatusIcon } from "./StatusIcon";
import { Icon } from "./Icon";
import { Pill } from "./Pill";

type Status = "todo" | "doing" | "done";
export type Card = { id: number; title: string; status: Status; priority: number; due: string | null; project_name: string | null; project_color: string | null; tags: string[]; repeat: string | null };
const COLS: { key: Status; label: string }[] = [{ key: "todo", label: "To do" }, { key: "doing", label: "In progress" }, { key: "done", label: "Done" }];
const lift = "shadow-[0_1px_1px_rgb(9_30_66/0.25),0_0_1px_rgb(9_30_66/0.31)] dark:shadow-none dark:border";

export function Board({ cards, today }: { cards: Card[]; today: string }) {
  const [items, setItems] = useOptimistic(cards, (s, a: { id: number; status: Status }) => s.map((c) => (c.id === a.id ? { ...c, status: a.status } : c)));
  const [, start] = useTransition();
  const [over, setOver] = useState<Status | null>(null);
  const move = (id: number, status: Status) => start(async () => { setItems({ id, status }); await moveTask(id, status); });

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
      {COLS.map((col, ci) => {
        const list = items.filter((c) => c.status === col.key);
        return (
          <section key={col.key} onDragOver={(e) => { e.preventDefault(); setOver(col.key); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = Number(e.dataTransfer.getData("text/plain")); if (id) move(id, col.key); }}
            className={`rise min-h-[60vh] w-[84%] shrink-0 snap-center rounded-xl bg-raise/70 p-2 transition md:w-auto ${over === col.key ? "ring-2 ring-accent/50" : ""}`} style={{ ["--i" as string]: ci }}>
            <h2 className="flex items-center gap-2 px-2 pb-2.5 pt-1.5 text-xs font-semibold uppercase tracking-wide text-mute">{col.label}<span className="font-medium text-dim">{list.length}</span></h2>
            <ul className="space-y-2">
              {list.map((c) => {
                const d = c.due && c.status !== "done" ? (c.due < today ? "text-danger" : c.due === today ? "text-ok" : "text-mute") : "text-mute";
                const done = c.status === "done";
                return (
                  <li key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", String(c.id))}
                    className={`group relative cursor-grab rounded-lg bg-panel p-3 transition hover:bg-raise/40 active:cursor-grabbing ${lift}`}>
                    <Link href={`/tasks/${c.id}`} className={`block pr-12 text-[14px] leading-snug ${done ? "text-dim line-through" : ""}`}>{c.title}</Link>
                    {c.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{c.tags.map((g) => <Pill key={g} name={g} />)}</div>}
                    <div className="mt-3 flex items-center gap-2 text-xs text-mute">
                      <StatusIcon status={c.status} size={15} />
                      <span className={`font-medium ${done ? "line-through" : ""}`}>{issueKey(c.project_name, c.id)}</span>
                      <span className="ml-auto flex items-center gap-2">
                        {c.repeat && <Icon name="repeat" size={13} />}
                        {c.due && <span className={`inline-flex items-center gap-1 ${d}`}><Icon name="calendar" size={12} />{c.due === today ? "Today" : nice(c.due).split(", ")[1]}</span>}
                        {c.priority > 0 && <Icon name="chevUp2" size={15} className="text-danger" />}{c.priority < 0 && <Icon name="chevDown1" size={15} className="text-accent" />}
                      </span>
                    </div>
                    <div className="absolute right-1.5 top-1.5 flex text-mute [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100">
                      <button disabled={ci === 0} onClick={() => move(c.id, COLS[ci - 1].key)} aria-label={`Move to ${COLS[ci - 1]?.label}`} className="grid h-6 w-6 place-items-center rounded hover:bg-raise disabled:invisible"><Icon name="chevRight" size={15} className="rotate-180" /></button>
                      <button disabled={ci === COLS.length - 1} onClick={() => move(c.id, COLS[ci + 1].key)} aria-label={`Move to ${COLS[ci + 1]?.label}`} className="grid h-6 w-6 place-items-center rounded hover:bg-raise disabled:invisible"><Icon name="chevRight" size={15} /></button>
                    </div>
                  </li>
                );
              })}
              {!list.length && <li className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-dim">{col.key === "done" ? "Finished tasks land here" : "Drop a card here"}</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
