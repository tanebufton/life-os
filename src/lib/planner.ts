import { eventsOn } from "./calendar";
import { getSetting } from "./settings";
import { queryTasks, updateTask, type TaskRow } from "./tasks";
import { localNow, today } from "./time";

export const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
export const toHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const DEFAULT_MIN = 30;
export type Block = { key: string; id?: number; title: string; start: number; end: number; kind: "task" | "event"; done?: boolean; color?: string; conflict?: boolean };
export const workHours = () => ({ start: toMin(getSetting("work_start") ?? "09:00"), end: toMin(getSetting("work_end") ?? "17:30") });

export function dayBlocks(date: string): { blocks: Block[]; allDay: { title: string; color?: string }[] } {
  const blocks: Block[] = [];
  for (const t of queryTasks({ dueOn: date, state: "all", includeSub: false })) if (t.due_time) blocks.push({ key: `t${t.id}`, id: t.id, title: t.title, start: toMin(t.due_time), end: Math.min(24 * 60, toMin(t.due_time) + (t.estimate ?? DEFAULT_MIN)), kind: "task", done: !!t.done_at });
  const allDay: { title: string; color?: string }[] = [];
  for (const e of eventsOn(date)) {
    if (e.all_day || !e.start_time) { allDay.push({ title: e.title, color: e.color }); continue; }
    const s = e.date < date ? 0 : toMin(e.start_time), en = !e.end_time || (e.end_date && e.end_date > date) ? 24 * 60 : Math.max(s + 15, toMin(e.end_time));
    blocks.push({ key: `e${e.id}`, title: e.title, start: s, end: en, kind: "event", color: e.color });
  }
  blocks.sort((a, b) => a.start - b.start || a.end - b.end);
  for (const b of blocks) b.conflict = blocks.some((o) => o !== b && !o.done && !b.done && o.start < b.end && b.start < o.end && (o.kind === "task" || b.kind === "task"));
  return { blocks, allDay };
}
export function unscheduled(date: string, t = today()): TaskRow[] {
  return queryTasks({ dueBy: date }).filter((x) => !x.due_time && (x.due === date || (date === t && x.due! < t)));
}
/** Free gaps (minutes since midnight) inside [from, to], excluding open tasks and events. */
export function freeSlots(date: string, from: number, to: number): [number, number][] {
  const busy = dayBlocks(date).blocks.filter((b) => !b.done).map((b) => [b.start, b.end] as [number, number]).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = []; let cur = from;
  for (const [s, e] of busy) { if (e <= cur) continue; if (s > cur) out.push([cur, Math.min(s, to)]); cur = Math.max(cur, e); if (cur >= to) break; }
  if (cur < to) out.push([cur, to]);
  return out.filter(([a, b]) => b > a);
}
export function findSlot(date: string, minutes: number, from?: number): number | null {
  const w = workHours(); const s = freeSlots(date, Math.max(from ?? w.start, w.start), w.end).find(([a, b]) => b - a >= minutes); return s ? s[0] : null;
}
/** Pack tasks without a time into free gaps. Bigger/higher-priority tasks go first; nothing is placed in the past today. */
export function autoSchedule(date: string, t = today(), now = new Date()): { scheduled: { id: number; title: string; time: string; minutes: number }[]; leftover: { id: number; title: string }[] } {
  const w = workHours(); let from = w.start;
  if (date === t) { const n = toMin(localNow(now).hm); from = Math.max(from, Math.ceil(n / 15) * 15); }
  const todo = unscheduled(date, t).sort((a, b) => b.priority - a.priority || (b.estimate ?? DEFAULT_MIN) - (a.estimate ?? DEFAULT_MIN) || a.id - b.id);
  const scheduled: { id: number; title: string; time: string; minutes: number }[] = [], leftover: { id: number; title: string }[] = [];
  for (const task of todo) {
    const mins = task.estimate ?? DEFAULT_MIN, start = findSlot(date, mins, from);
    if (start === null) { leftover.push({ id: task.id, title: task.title }); continue; }
    updateTask(task.id, { due: date, due_time: toHm(start) }); scheduled.push({ id: task.id, title: task.title, time: toHm(start), minutes: mins });
  }
  return { scheduled, leftover };
}
