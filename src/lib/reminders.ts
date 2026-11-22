import { db } from "./db";
import { isOn } from "./features";
import { briefText, dailyBrief } from "./brief";
import { notify, notifyConfigured, type Note } from "./notify";
import { inQuietHours } from "./misc";
import { getSetting } from "./settings";
import { fmtTime } from "./dates";
import { queryTasks } from "./tasks";
import { localNow } from "./time";
import { browserNotifyConfig, dueReminders } from "./browsernotify";
import { pushConfigured, sendPush, type PushPayload } from "./webpush";

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
  const brief = await briefNote(now, `brief:${date}`); if (brief) out.push({ key: `brief:${date}`, note: brief });
  if (inQuietHours(hm, getSetting("quiet_start"), getSetting("quiet_end"))) return []; // held back, not marked as sent, so they go out when quiet hours end
  return out;
}
/** The morning brief, if it's time for it, `key` hasn't been sent yet, and there's something to say. */
async function briefNote(now: Date, key: string): Promise<Note | null> {
  const cur = mins(localNow(now).hm), bt = getSetting("brief_time") ?? "08:00";
  if (!bt || cur < mins(bt) || cur > mins(bt) + 180 || sent(key)) return null;
  const b = await dailyBrief({ network: false });
  if (b.overdue.length + b.due_today.length + b.in_progress.length === 0) return null;
  const x = briefText(b); return { title: x.title, body: x.body, click: "/", tags: ["sunrise"] };
}
/**
 * Sends everything pending. Nothing is marked as sent unless at least one channel accepted it.
 * ntfy, webhook and Telegram get the due-time reminders and the brief; Web Push devices get them through `pushPending` (below).
 */
export async function runReminders(now = new Date(), send: (n: Note) => Promise<Record<string, string | undefined>> = notify, push: typeof sendPush = sendPush): Promise<number> {
  const c = notifyConfigured(), classic = c.ntfy || c.webhook || c.telegram, viaPush = pushConfigured();
  if (!classic && !viaPush) return 0;
  let n = 0;
  if (classic) for (const p of await pending(now)) {
    const r = await send(p.note);
    if (Object.values(r).includes("ok")) { mark(p.key); n++; }
  }
  if (viaPush) n += await sendPushPending(await pushPending(now), push);
  return n;
}

export type PushItem = { key: string; payload: PushPayload; ttl: number };
/**
 * What Web Push devices should get right now. Task reminders follow the browser-reminder settings, so a push looks and behaves like the
 * pop-up in an open tab: it arrives `lead` minutes early, has Mark done and Snooze, and comes back when a snooze ends (the snooze changes
 * the token, so it is a new key). It shares the tag `task-<id>` with the in-tab pop-up, so a device never shows both.
 */
export async function pushPending(now = new Date()): Promise<PushItem[]> {
  if (!isOn("reminders")) return [];
  const { date, hm } = localNow(now);
  if (inQuietHours(hm, getSetting("quiet_start"), getSetting("quiet_end"))) return [];
  const snooze = browserNotifyConfig().snooze, out: PushItem[] = [];
  for (const d of dueReminders(now)) {
    const key = `push:${d.token}`;
    if (!sent(key)) out.push({ key, ttl: 2 * 3600, payload: { title: d.title, body: [`Due ${fmtTime(d.time)}`, d.project].filter(Boolean).join(" · "), url: `/tasks/${d.id}?reminder=1`, tag: `task-${d.id}`, id: d.id, snooze, actions: true, priority: 4 } });
  }
  const brief = await briefNote(now, `push:brief:${date}`);
  if (brief) out.push({ key: `push:brief:${date}`, ttl: 6 * 3600, payload: { title: brief.title, body: brief.body, url: "/", tag: "lifeos-brief" } });
  return out;
}
async function sendPushPending(items: PushItem[], push: typeof sendPush): Promise<number> {
  let n = 0;
  for (const it of items) { const r = await push(it.payload, { ttl: it.ttl }); if (r.sent > 0) { mark(it.key); n++; } }
  return n;
}
