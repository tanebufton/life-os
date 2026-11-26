"use client";
// Small client pieces for start dates, "must do today" and reminders.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { addReminderAction, removeReminderAction, resolveLeftoversAction, setFocusAction } from "@/lib/actions";
import { addDays, fmtTime, nice } from "@/lib/dates";
import { Icon } from "./Icon";

/** The flame button: flag a task as "must do today" (it pins to the top of Today), or take the flag off. */
export function FocusToggle({ id, on, size = "row" }: { id: number; on: boolean; size?: "row" | "button" }) {
  const router = useRouter(), [v, setV] = useState(on), [, go] = useTransition();
  useEffect(() => setV(on), [on]);
  const click = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const next = !v; setV(next);
    go(async () => { const ok = await setFocusAction(id, next); if (!ok) { setV(!next); toast("Couldn't change that"); return; } toast(next ? "Added to today's focus" : "Removed from today's focus"); router.refresh(); });
  };
  const label = v ? "Remove from today's focus" : "Must do today";
  if (size === "button") return <button type="button" aria-pressed={v} onClick={click} className={`btn !h-8 ${v ? "!border-warn/50 !bg-warn/10 text-warn" : ""}`}><Icon name="flame" size={15} className={v ? "text-warn" : "text-mute"} />{v ? "In today's focus" : "Must do today"}</button>;
  return <button type="button" aria-pressed={v} aria-label={label} title={label} onClick={click}
    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition hover:bg-raise ${v ? "text-warn" : "text-mute hover:text-fg"}`}><Icon name="flame" size={15} /></button>;
}

/** On Today: focus tasks from an earlier day that weren't finished. Carry each over, or drop it from focus (the task itself stays). */
export function FocusLeftovers({ items }: { items: { id: number; title: string; focus_on: string }[] }) {
  const router = useRouter(), [gone, setGone] = useState<number[]>([]), [, go] = useTransition();
  const left = items.filter((x) => !gone.includes(x.id));
  if (!left.length) return null;
  const act = (ids: number[], carry: boolean) => { setGone((g) => [...g, ...ids]); go(async () => { await resolveLeftoversAction(ids, carry); toast(carry ? `Carried over to today${ids.length > 1 ? ` (${ids.length})` : ""}` : `Dropped from focus${ids.length > 1 ? ` (${ids.length})` : ""}`); router.refresh(); }); };
  const when = left.every((x) => x.focus_on === left[0].focus_on) ? `from ${nice(left[0].focus_on)}` : "from earlier days";
  return (
    <section className="rise mb-5 rounded-xl border border-warn/30 bg-warn/5 px-3 py-2.5" aria-label="Unfinished focus">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Icon name="flame" size={16} className="text-warn" />
        <p className="text-[13.5px]"><b>{left.length} unfinished</b> in your focus {when}. Carry them over to today, or drop them from focus (the tasks stay in your list).</p>
        {left.length > 1 && <span className="ml-auto flex gap-1.5"><button className="btn !h-7 !text-[12px]" onClick={() => act(left.map((x) => x.id), true)}>Carry all over</button><button className="btn !h-7 !text-[12px]" onClick={() => act(left.map((x) => x.id), false)}>Drop all</button></span>}
      </div>
      <ul className="mt-1.5">{left.map((x) => (
        <li key={x.id} className="flex items-center gap-2 rounded-md px-1 py-1 text-[14px] hover:bg-raise/50">
          <a href={`/tasks/${x.id}`} className="min-w-0 flex-1 truncate">{x.title}</a>
          <button className="rounded-md px-2 py-0.5 text-[12px] text-accent hover:bg-accent/10" onClick={() => act([x.id], true)}>Carry over</button>
          <button className="rounded-md px-2 py-0.5 text-[12px] text-mute hover:bg-raise hover:text-fg" onClick={() => act([x.id], false)}>Drop</button>
        </li>))}</ul>
    </section>
  );
}

export type ReminderItem = { id: number; at: string | null; before_min: number | null };
const beforeLabel = (n: number) => (n % 1440 === 0 ? `${n / 1440} day${n === 1440 ? "" : "s"}` : n % 60 === 0 ? `${n / 60} hour${n === 60 ? "" : "s"}` : `${n} min`) + " before";
export const reminderLabel = (r: ReminderItem, today?: string) => {
  if (!r.at) return beforeLabel(r.before_min ?? 0);
  const d = r.at.slice(0, 10), day = today && d === today ? "Today" : today && d === addDays(today, 1) ? "Tomorrow" : nice(d);
  return `${day}, ${fmtTime(r.at.slice(11, 16))}`;
};
/** The task's reminders, with quick picks and a date + time to add one. Works with or without a due date. */
export function RemindersField({ taskId, items, due, dueTime, today, defaultTime }: { taskId: number; items: ReminderItem[]; due: string | null; dueTime: string | null; today: string; defaultTime: string }) {
  const router = useRouter(), [list, setList] = useState(items), [open, setOpen] = useState(false), [, go] = useTransition();
  const dt = defaultTime || "09:00", [date, setDate] = useState(due ?? today), [time, setTime] = useState(dt);
  useEffect(() => setList(items), [items]);
  const add = (r: { at?: string; before?: number }) => go(async () => {
    const res = await addReminderAction(taskId, r);
    if (!res.ok) return void toast(res.error);
    setList((l) => (l.some((x) => x.id === res.id) ? l : [...l, { id: res.id, at: r.at ?? null, before_min: r.at ? null : r.before ?? null }])); setOpen(false); router.refresh();
  });
  const remove = (id: number) => { setList((l) => l.filter((x) => x.id !== id)); go(async () => { await removeReminderAction(id); router.refresh(); }); };
  const picks: [string, { at?: string; before?: number }][] = [];
  if (due && dueTime) picks.push(["30 min before", { before: 30 }], ["1 hour before", { before: 60 }]);
  if (due && due > today) picks.push(["Day before", { at: `${addDays(due, -1)} ${dueTime ?? dt}` }]);
  if (due) picks.push([due === today ? `Today ${fmtTime(dt)}` : `On the day ${fmtTime(dt)}`, { at: `${due} ${dt}` }]);
  if (!due) picks.push([`Tomorrow ${fmtTime(dt)}`, { at: `${addDays(today, 1)} ${dt}` }]);
  return (
    <div className="min-w-0">
      {list.length > 0 && <ul className="mb-1 flex flex-wrap gap-1">{list.map((r) => (
        <li key={r.id} className="inline-flex h-7 items-center gap-1 rounded-md bg-raise/70 pl-2 pr-0.5 text-[12.5px]">
          <Icon name="bell" size={12} className="text-mute" />{reminderLabel(r, today)}
          <button type="button" aria-label={`Remove the reminder ${reminderLabel(r, today)}`} onClick={() => remove(r.id)} className="grid h-6 w-6 place-items-center rounded text-dim hover:bg-raise hover:text-fg"><Icon name="x" size={12} /></button>
        </li>))}</ul>}
      {!open ? <button type="button" onClick={() => setOpen(true)} className="ghost h-8 px-1 text-left text-[13px] text-mute hover:text-fg">{list.length ? "+ Add another" : "Add a reminder"}</button> : (
        <div className="mt-1 space-y-1.5 rounded-lg border bg-raise/30 p-2">
          <div className="flex flex-wrap gap-1">{picks.map(([l, r]) => <button key={l} type="button" onClick={() => add(r)} className="h-7 rounded-md bg-raise/70 px-2 text-[12px] text-mute hover:bg-raise hover:text-fg">{l}</button>)}</div>
          <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (date && time) add({ at: `${date} ${time}` }); }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Reminder date" className="ghost min-w-[8.5rem] flex-1" required />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Reminder time" className="ghost !w-[7rem]" required />
            <button className="btn !h-7 !text-[12px]">Add</button>
            <button type="button" onClick={() => setOpen(false)} className="h-7 px-1.5 text-[12px] text-mute hover:text-fg">Cancel</button>
          </form>
        </div>)}
    </div>
  );
}
