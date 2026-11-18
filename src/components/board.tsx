"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveTask } from "@/lib/actions";

type Status = "todo" | "doing" | "done";
export type Card = { id: number; title: string; status: Status; priority: number; due: string | null; project_name: string | null; project_color: string | null; tags: string[]; repeat: string | null };
const COLS: { key: Status; label: string }[] = [{ key: "todo", label: "To do" }, { key: "doing", label: "Doing" }, { key: "done", label: "Done" }];

export function Board({ cards, today }: { cards: Card[]; today: string }) {
  const [items, setItems] = useOptimistic(cards, (s, a: { id: number; status: Status }) => s.map((c) => (c.id === a.id ? { ...c, status: a.status } : c)));
  const [, start] = useTransition();
  const [over, setOver] = useState<Status | null>(null);
  const move = (id: number, status: Status) => start(async () => { setItems({ id, status }); await moveTask(id, status); });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLS.map((col, ci) => {
        const list = items.filter((c) => c.status === col.key);
        return (
          <section key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOver(col.key); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = Number(e.dataTransfer.getData("text/plain")); if (id) move(id, col.key); }}
            className={`min-h-32 rounded-xl border p-3 transition-colors ${over === col.key ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40" : "border-neutral-200 bg-neutral-100/60 dark:border-neutral-800 dark:bg-neutral-900/60"}`}>
            <h2 className="mb-2 flex justify-between text-sm font-semibold">{col.label}<span className="font-normal text-neutral-500">{list.length}</span></h2>
            <ul className="space-y-2">
              {list.map((c) => (
                <li key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", String(c.id))}
                  className="cursor-grab rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm active:cursor-grabbing dark:border-neutral-700 dark:bg-neutral-800">
                  <Link href={`/tasks/${c.id}`} className={`block break-words text-sm ${c.status === "done" ? "text-neutral-400 line-through" : ""}`}>
                    {c.priority > 0 && <span className="mr-1 text-red-500">!</span>}{c.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                    {c.project_name && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c.project_color ?? "#999" }} />{c.project_name}</span>}
                    {c.due && <span className={c.status !== "done" && c.due < today ? "text-red-500" : ""}>{c.due === today ? "today" : c.due}</span>}
                    {c.repeat && <span>↻</span>}
                    {c.tags.map((g) => <span key={g} className="text-indigo-600 dark:text-indigo-400">#{g}</span>)}
                  </div>
                  {/* tap targets for touch screens, where HTML5 drag-and-drop doesn't work */}
                  <div className="mt-2 flex justify-between">
                    <button disabled={ci === 0} onClick={() => move(c.id, COLS[ci - 1].key)} aria-label={`Move to ${COLS[ci - 1]?.label}`} className="rounded px-2 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:invisible dark:hover:bg-neutral-700">←</button>
                    <button disabled={ci === COLS.length - 1} onClick={() => move(c.id, COLS[ci + 1].key)} aria-label={`Move to ${COLS[ci + 1]?.label}`} className="rounded px-2 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:invisible dark:hover:bg-neutral-700">→</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
