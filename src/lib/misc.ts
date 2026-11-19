import { db } from "./db";
import { assertPublicUrl } from "./netsafe";
import { queryTasks, type TaskRow } from "./tasks";
import { today } from "./time";
import { diffDays } from "./dates";
import { firstUrl, hostOf } from "./ui";

// ---------- trash ----------
export const listTrash = () => db.prepare("SELECT id, title, deleted_at, parent_id FROM tasks WHERE deleted_at IS NOT NULL AND parent_id IS NULL ORDER BY deleted_at DESC LIMIT 200").all() as { id: number; title: string; deleted_at: string; parent_id: number | null }[];
export const purgeTask = (id: number) => db.prepare("DELETE FROM tasks WHERE id=? AND deleted_at IS NOT NULL").run(id).changes > 0;
export const emptyTrash = () => db.prepare("DELETE FROM tasks WHERE deleted_at IS NOT NULL").run().changes;
// ---------- saved filters ----------
export type SavedFilter = { id: number; name: string; query: string };
export const listFilters = () => db.prepare("SELECT * FROM saved_filters ORDER BY name COLLATE NOCASE").all() as SavedFilter[];
export function saveFilter(name: string, query: string) { if (!name.trim() || !query.trim()) throw new Error("A filter needs a name and a query"); return Number(db.prepare("INSERT INTO saved_filters (name, query) VALUES (?,?)").run(name.trim().slice(0, 60), query.trim()).lastInsertRowid); }
export const deleteFilter = (id: number) => db.prepare("DELETE FROM saved_filters WHERE id=?").run(id).changes > 0;
// ---------- comments ----------
export const listComments = (taskId: number) => db.prepare("SELECT id, body, created_at FROM task_comments WHERE task_id=? ORDER BY id").all(taskId) as { id: number; body: string; created_at: string }[];
export function addComment(taskId: number, body: string) { if (!body.trim()) throw new Error("Comment is empty"); return Number(db.prepare("INSERT INTO task_comments (task_id, body) VALUES (?,?)").run(taskId, body.trim().slice(0, 5000)).lastInsertRowid); }
export const deleteComment = (id: number) => db.prepare("DELETE FROM task_comments WHERE id=?").run(id).changes > 0;
// ---------- link titles ----------
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
export function titleFromHtml(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const t = og?.[1] ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return t ? decode(t).slice(0, 200) || null : null;
}
export async function fetchPageTitle(url: string): Promise<string | null> {
  if (process.env.LIFEOS_ALLOW_PRIVATE_FETCH !== "1") assertPublicUrl(url); else if (!/^https?:\/\//i.test(url)) return null;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 (compatible; LifeOS link preview)", accept: "text/html" }, redirect: "follow" });
  if (!r.ok || !/html/i.test(r.headers.get("content-type") ?? "")) return null;
  const reader = r.body?.getReader(); let buf = ""; const dec = new TextDecoder();
  while (reader && buf.length < 200_000) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); if (/<\/head>/i.test(buf)) break; }
  void reader?.cancel().catch(() => {});
  return titleFromHtml(buf);
}
/** If a task's title is just a link (or the host of one), replace it with the page's real title. Never throws. */
export async function enrichLinkTask(id: number): Promise<boolean> {
  try {
    const t = db.prepare("SELECT title, notes FROM tasks WHERE id=?").get(id) as { title: string; notes: string } | undefined; if (!t) return false;
    const url = firstUrl(t.title, t.notes); if (!url) return false;
    const bare = t.title.trim() === url || t.title.trim() === hostOf(url) || /^https?:\/\/\S+$/.test(t.title.trim()); if (!bare) return false;
    const title = await fetchPageTitle(url); if (!title) return false;
    db.prepare("UPDATE tasks SET title=?, notes=CASE WHEN notes LIKE ? THEN notes ELSE trim(notes || char(10) || ?) END WHERE id=?").run(title, `%${url}%`, url, id); return true;
  } catch { return false; }
}
// ---------- quiet hours ----------
export function inQuietHours(hm: string, start?: string | null, end?: string | null): boolean {
  if (!start || !end || start === end) return false; const m = (x: string) => { const [h, mi] = x.split(":").map(Number); return h * 60 + mi; };
  const n = m(hm), s = m(start), e = m(end); return s < e ? n >= s && n < e : n >= s || n < e;
}
// ---------- do-now ----------
/** The single most sensible next task: overdue/timed first, then high priority, then in-progress, then soonest. */
export function nextBest(skip: number[] = [], t = today()): TaskRow | null {
  const score = (x: TaskRow) => (x.due && x.due < t ? 100 + Math.min(30, diffDays(t, x.due)) : x.due === t ? 80 : x.due ? Math.max(0, 40 - diffDays(x.due, t)) : 10) + x.priority * 25 + (x.status_kind === "doing" ? 30 : 0) + (x.due_time ? 15 : 0) - (x.estimate && x.estimate > 90 ? 10 : 0);
  return queryTasks().filter((x) => !skip.includes(x.id)).sort((a, b) => score(b) - score(a) || a.id - b.id)[0] ?? null;
}
// ---------- eisenhower matrix ----------
export function matrix(tasks: TaskRow[], t = today()) {
  const urgent = (x: TaskRow) => !!x.due && diffDays(x.due, t) <= 2, important = (x: TaskRow) => x.priority > 0;
  return { doNow: tasks.filter((x) => urgent(x) && important(x)), schedule: tasks.filter((x) => !urgent(x) && important(x)), delegate: tasks.filter((x) => urgent(x) && !important(x) && x.priority === 0), drop: tasks.filter((x) => !urgent(x) && !important(x) && x.priority <= 0) };
}
