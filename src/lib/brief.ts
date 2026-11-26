import { addDays, fmtTime } from "./dates";
import { focusToday } from "./focus";
import { isOn } from "./features";
import { doneToday, queryTasks, type TaskRow } from "./tasks";
import { today } from "./time";

export const briefTask = (t: TaskRow) => ({ id: t.id, title: t.title, status: t.status_name, project: t.project_name, due: t.due, time: t.due_time, estimate: t.estimate, priority: t.priority, tags: t.tags, subtasks: t.sub_total ? `${t.sub_done}/${t.sub_total}` : undefined });

export async function dailyBrief(_o: { network?: boolean } = {}) {
  const t = today();
  const open = queryTasks({ started: true });
  const planned = open.filter((x) => x.due && x.due <= t).reduce((n, x) => n + (x.estimate ?? 0), 0);
  return {
    today: t,
    focus: queryTasks({ focus: true, includeSub: true }).map(briefTask),
    overdue: open.filter((x) => x.due && x.due < t).map(briefTask),
    due_today: open.filter((x) => x.due === t).map(briefTask),
    in_progress: open.filter((x) => x.status_kind === "doing").map(briefTask),
    upcoming: open.filter((x) => x.due && x.due > t && x.due <= addDays(t, 3)).map(briefTask),
    inbox_count: queryTasks({ inbox: true, started: true }).length,
    planned_minutes: planned, done_today: doneToday(), focus_today: isOn("focus") ? focusToday() : undefined,
  };
}
export function briefText(b: Awaited<ReturnType<typeof dailyBrief>>): { title: string; body: string } {
  const n = b.overdue.length + b.due_today.length;
  const lines: string[] = [];
  const show = (label: string, ts: ReturnType<typeof briefTask>[]) => { if (ts.length) lines.push(`${label}: ` + ts.slice(0, 5).map((x) => x.title + (x.time ? ` (${fmtTime(x.time)})` : "")).join(", ") + (ts.length > 5 ? ` +${ts.length - 5} more` : "")); };
  show("Focus", b.focus ?? []); show("Overdue", b.overdue); show("Today", b.due_today);
  if (b.planned_minutes) lines.push(`Planned: ${Math.round(b.planned_minutes / 6) / 10}h`);
  return { title: n ? `Good morning: ${n} ${n === 1 ? "task" : "tasks"} today` : "Good morning: nothing due today", body: lines.join("\n") || "Enjoy the day." };
}
