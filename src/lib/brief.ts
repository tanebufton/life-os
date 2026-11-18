import { addDays, fmtTime } from "./dates";
import { focusToday } from "./focus";
import { isOn } from "./features";
import { habitsToday } from "./habits";
import { getNews } from "./news";
import { doneToday, queryTasks, type TaskRow } from "./tasks";
import { today } from "./time";
import { getWeather } from "./weather";

export const briefTask = (t: TaskRow) => ({ id: t.id, title: t.title, status: t.status, project: t.project_name, due: t.due, time: t.due_time, estimate: t.estimate, priority: t.priority, tags: t.tags, subtasks: t.sub_total ? `${t.sub_done}/${t.sub_total}` : undefined });

export async function dailyBrief(o: { network?: boolean } = {}) {
  const t = today(), net = o.network !== false;
  const open = queryTasks();
  const [weather, news] = net ? await Promise.allSettled([isOn("weather") ? getWeather() : Promise.resolve(null), isOn("news") ? getNews(5) : Promise.resolve(null)]) : [null, null];
  const planned = open.filter((x) => x.due && x.due <= t).reduce((n, x) => n + (x.estimate ?? 0), 0);
  return {
    today: t,
    overdue: open.filter((x) => x.due && x.due < t).map(briefTask),
    due_today: open.filter((x) => x.due === t).map(briefTask),
    in_progress: open.filter((x) => x.status === "doing").map(briefTask),
    upcoming: open.filter((x) => x.due && x.due > t && x.due <= addDays(t, 3)).map(briefTask),
    inbox_count: queryTasks({ inbox: true }).length,
    planned_minutes: planned, done_today: doneToday(), focus_today: isOn("focus") ? focusToday() : undefined,
    habits: isOn("habits") ? habitsToday().filter((h) => h.scheduled).map((h) => ({ name: h.name, done: h.done, streak: h.streak })) : undefined,
    weather: weather && weather.status === "fulfilled" ? weather.value : undefined,
    headlines: news && news.status === "fulfilled" && news.value ? news.value.items.map((i) => `${i.title} (${i.source})`) : undefined,
  };
}
export function briefText(b: Awaited<ReturnType<typeof dailyBrief>>): { title: string; body: string } {
  const n = b.overdue.length + b.due_today.length;
  const lines: string[] = [];
  const show = (label: string, ts: ReturnType<typeof briefTask>[]) => { if (ts.length) lines.push(`${label}: ` + ts.slice(0, 5).map((x) => x.title + (x.time ? ` (${fmtTime(x.time)})` : "")).join(", ") + (ts.length > 5 ? ` +${ts.length - 5} more` : "")); };
  show("Overdue", b.overdue); show("Today", b.due_today);
  if (b.planned_minutes) lines.push(`Planned: ${Math.round(b.planned_minutes / 6) / 10}h`);
  const hb = b.habits?.filter((h) => !h.done); if (hb?.length) lines.push(`Habits: ${hb.map((h) => h.name).join(", ")}`);
  if (b.weather && "temp" in b.weather) lines.push(`${b.weather.place.split(",")[0]}: ${b.weather.temp}° ${b.weather.description}`);
  return { title: n ? `Good morning: ${n} ${n === 1 ? "task" : "tasks"} today` : "Good morning: nothing due today", body: lines.join("\n") || "Enjoy the day." };
}
