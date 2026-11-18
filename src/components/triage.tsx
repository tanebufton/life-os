"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { triage } from "@/lib/actions";
import { diffDays, fmtMinutes, fmtTime, nice } from "@/lib/dates";
import { Icon } from "./Icon";

type Item = { id: number; title: string; due: string | null; time: string | null; estimate: number | null; project: string | null; color: string | null; priority: number };
type Act = "today" | "tomorrow" | "nextweek" | "someday" | "done" | "drop";
const LABEL: Record<Act, string> = { today: "Today", tomorrow: "Tomorrow", nextweek: "Next week", someday: "Someday", done: "Done", drop: "Drop" };
const DONE_MSG: Record<Act, string> = { today: "Moved to today", tomorrow: "Moved to tomorrow", nextweek: "Moved to next week", someday: "Date removed", done: "Marked done", drop: "Dropped" };

/** One-tap decisions for each task, then it slides away. */
const dueLabel = (due: string, today: string) => { const d = diffDays(due, today); return d === 0 ? { t: "Today", c: "text-ok" } : d === 1 ? { t: "Tomorrow", c: "text-warn" } : d === -1 ? { t: "Yesterday", c: "text-danger" } : d < 0 ? { t: `${-d} days ago`, c: "text-danger" } : { t: nice(due).replace(",", ""), c: "text-mute" }; };
export function TriageList({ items, actions, empty, today }: { items: Item[]; actions: Act[]; empty: string; today: string }) {
  const [list, setList] = useState(items), [, start] = useTransition();
  const act = (it: Item, a: Act) => { setList((l) => l.filter((x) => x.id !== it.id)); start(async () => { await triage(it.id, a); toast(`${DONE_MSG[a]}: ${it.title}`); }); };
  if (!list.length) return <p className="flex items-center gap-2 px-4 py-5 text-[13px] text-mute"><Icon name="circleCheck" size={16} className="text-ok" />{empty}</p>;
  const tone = (a: Act) => a === "done" ? "text-ok" : a === "drop" ? "text-danger" : "text-fg/80";
  return (
    <ul>{list.map((it) => (
      <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 last:border-b-0">
        <div className="min-w-0 flex-1 basis-48">
          <Link href={`/tasks/${it.id}`} className="block truncate text-[14.5px]">{it.priority > 0 && <span className="mr-1 text-danger">!</span>}{it.title}</Link>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-mute">{it.due && (() => { const l = dueLabel(it.due, today); return <span className={l.c}>{l.t}{it.time ? ` · ${fmtTime(it.time)}` : ""}</span>; })()}{it.project && <span>{it.project}</span>}{it.estimate ? <span>{fmtMinutes(it.estimate)}</span> : null}</div>
        </div>
        <div className="flex flex-wrap gap-1">{actions.map((a) => <button key={a} onClick={() => act(it, a)} className={`rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-raise ${tone(a)}`}>{LABEL[a]}</button>)}</div>
      </li>))}</ul>
  );
}
