import { db } from "./db";
import { isOn } from "./features";
import { habitsToday } from "./habits";
import { budgetAlerts, monthOf } from "./money";
import { subReminders } from "./subs";
import { briefText, dailyBrief } from "./brief";
import { notify, notifyConfigured, type Note } from "./notify";
import { inQuietHours } from "./misc";
import { peopleReminders } from "./people";
import { getSetting } from "./settings";
import { fmtTime } from "./dates";
import { queryTasks } from "./tasks";
import { localNow } from "./time";

const mins = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
const sent = (key: string) => !!db.prepare("SELECT 1 FROM notifications_sent WHERE key=?").get(key);
const mark = (key: string) => db.prepare("INSERT OR IGNORE INTO notifications_sent (key) VALUES (?)").run(key);

/** What should be pushed right now. Pure aside from reading the DB; `now` is injectable for tests. */
export async function pending(now = new Date()): Promise<{ key: string; note: Note }[]> {
  if (!isOn("reminders")) return [];
  const { date, hm } = localNow(now), cur = mins(hm), out: { key: string; note: Note }[] = [];
  // 1. tasks with a due time: remind at that time (within a 2h window so a restart never replays the whole day)
  for (const t of queryTasks({ dueOn: date, includeSub: true })) {
    if (!t.due_time) continue;
    const late = cur - mins(t.due_time);
    const key = `task:${t.id}:${t.due}:${t.due_time}`;
    if (late >= 0 && late <= 120 && !sent(key)) out.push({ key, note: { title: t.title, body: `Due ${fmtTime(t.due_time)}${t.project_name ? " · " + t.project_name : ""}${t.estimate ? ` · ~${t.estimate}m` : ""}`, click: `/tasks/${t.id}`, priority: t.priority > 0 ? 4 : 3, tags: ["alarm_clock"] } });
  }
  // 2. morning brief
  const bt = getSetting("brief_time") ?? "08:00";
  if (bt && cur >= mins(bt) && cur <= mins(bt) + 180 && !sent(`brief:${date}`)) {
    const b = await dailyBrief({ network: false });
    if (b.overdue.length + b.due_today.length + b.in_progress.length > 0 || b.habits?.length) { const x = briefText(b); out.push({ key: `brief:${date}`, note: { title: x.title, body: x.body, click: "/", tags: ["sunrise"] } }); }
  }
  // 3. evening habit nudge
  const ht = getSetting("habit_nudge_time") ?? "20:00";
  if (isOn("habits") && ht && cur >= mins(ht) && cur <= mins(ht) + 120 && !sent(`habits:${date}`)) {
    const left = habitsToday(date).filter((h) => h.scheduled && !h.done);
    if (left.length) out.push({ key: `habits:${date}`, note: { title: `${left.length} habit${left.length === 1 ? "" : "s"} left today`, body: left.map((h) => h.name).join(", "), click: "/habits", tags: ["seedling"] } });
  }
  // 4. subscription renewals / trial endings, and budget thresholds (from the brief time onwards)
  if (cur >= mins(bt || "08:00")) {
    if (isOn("subscriptions")) for (const r of subReminders(date)) if (!sent(r.key)) out.push({ key: r.key, note: { title: r.title, body: r.body, click: "/subscriptions", tags: ["credit_card"] } });
    if (isOn("money")) for (const a of budgetAlerts(monthOf(date))) { const key = `budget:${monthOf(date)}:${a.category.id}:${a.level}`; if (!sent(key)) out.push({ key, note: { title: `${a.category.name} is at ${a.pct}% of budget`, body: `${(a.spent / 100).toFixed(2)} of ${(a.budget / 100).toFixed(2)} spent this month`, click: "/money", priority: a.level === 100 ? 4 : 3, tags: ["warning"] } }); }
  }
  if (isOn("people")) for (const r of peopleReminders(date)) if (!sent(r.key)) out.push({ key: r.key, note: { title: r.title, body: r.body, click: "/people", tags: ["birthday"] } });
  if (inQuietHours(hm, getSetting("quiet_start"), getSetting("quiet_end"))) return []; // held back, not marked as sent, so they go out when quiet hours end
  return out;
}
/** Sends everything pending. Nothing is marked as sent unless at least one channel accepted it. */
export async function runReminders(now = new Date(), send: (n: Note) => Promise<Record<string, string | undefined>> = notify): Promise<number> {
  const c = notifyConfigured();
  if (!c.ntfy && !c.webhook && !c.telegram) return 0;
  let n = 0;
  for (const p of await pending(now)) {
    const r = await send(p.note);
    if (Object.values(r).includes("ok")) { mark(p.key); n++; }
  }
  return n;
}
