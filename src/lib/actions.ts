"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "./db";
import { FEATURES, featureDefault, isFeature, setFeature, type FeatureKey } from "./features";
import { logFocus as logFocusLib } from "./focus";
import { notify, notifyConfigured } from "./notify";
import { getSetting, setSetting } from "./settings";
import { addReminder, removeReminder, resolveLeftovers, setFocus, createTask, completeTask, deleteTask as softDelete, duplicateTask, getTask, parseQuickAdd, parseTags, reopenTask, reschedule, restoreTask, setStatus, updateTask, type Status } from "./tasks";
import { createToken, icalSecret, inboundSecret, revokeToken } from "./tokens";
import { today } from "./time";
import { enrichLinkTask } from "./misc";
import { MAX_TABS, NAV, SETTINGS_PAGE } from "./nav";
import { WIDGETS } from "./widgets";

const refresh = () => revalidatePath("/", "layout");
const Status = z.string().trim().min(1).max(40);
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ---------- tasks ----------
export async function quickAdd(fd: FormData) {
  const text = str(fd, "text");
  if (!text) return;
  const t = parseQuickAdd(text);
  const pid = Number(fd.get("project_id")) || null;
  if (pid && !t.project) t.project_id = pid;
  const day = str(fd, "due");
  if (/^\d{4}-\d{2}-\d{2}$/.test(day) && t.due === undefined) t.due = day;
  const pr = Number(fd.get("priority"));
  if ([1, -1].includes(pr) && !t.priority) t.priority = pr;
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 20000);
  if (notes) t.notes = notes;
  const extra = str(fd, "tags").split(/[\s,]+/).map((x) => x.replace(/^#/, "")).filter(Boolean).slice(0, 10);
  if (extra.length) t.tags = [...(t.tags ?? []), ...extra];
  const id = createTask(t); void enrichLinkTask(id);
  refresh();
}
export async function toggleTask(id: number): Promise<{ title: string; done: boolean; next_due?: string } | null> {
  const t = getTask(id);
  if (!t) return null;
  let out: { title: string; done: boolean; next_due?: string };
  if (t.done_at) { reopenTask(id); out = { title: t.title, done: false }; }
  else { const r = completeTask(id); out = { title: t.title, done: true, next_due: r?.next_due }; }
  refresh();
  return out;
}
export async function moveTask(id: number, status: string): Promise<{ ok: boolean; error?: string }> { try { setStatus(id, Status.parse(status)); refresh(); return { ok: true }; } catch (e) { return { ok: false, error: (e as Error).message }; } }
export async function rescheduleAction(id: number, to: string) { reschedule(id, to); refresh(); }
export async function deleteTaskInline(id: number): Promise<{ id: number; title: string } | null> { const t = getTask(id); if (!t || !softDelete(id)) return null; refresh(); return { id, title: t.title }; }
export async function restoreTaskAction(id: number) { restoreTask(id); refresh(); }
export async function deleteTask(id: number) { softDelete(id); refresh(); redirect(`/tasks?deleted=${id}`); }
export async function duplicateTaskAction(id: number): Promise<number | null> { const n = duplicateTask(id); refresh(); return n; }
export async function startFocus(id: number) { if (getTask(id)?.status_kind === "todo") setStatus(id, "doing"); refresh(); }
/** "Must do today" on or off. */
export async function setFocusAction(id: number, on: boolean): Promise<boolean> { const ok = setFocus(id, !!on); refresh(); return ok; }
/** Yesterday's (or earlier) unfinished focus tasks: carry them over to today, or drop them from focus. */
export async function resolveLeftoversAction(ids: number[], carry: boolean): Promise<number> { const n = resolveLeftovers(z.array(z.number().int().positive()).max(500).parse(ids), !!carry); refresh(); return n; }
export async function addReminderAction(taskId: number, r: { at?: string; before?: number }): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try { const id = addReminder(taskId, { ...(typeof r.at === "string" ? { at: r.at } : {}), ...(typeof r.before === "number" ? { before: Math.round(r.before) } : {}) }); if (!id) return { ok: false, error: "Task not found" }; refresh(); return { ok: true, id }; }
  catch (e) { return { ok: false, error: (e as Error).message }; }
}
export async function removeReminderAction(id: number): Promise<boolean> { const ok = removeReminder(id); refresh(); return ok; }
export async function addSubtask(parentId: number, title: string) { const t = title.trim(); if (t) createTask({ title: t, parent_id: parentId }); refresh(); }

const Patch = z.object({
  title: z.string().trim().min(1).max(500).optional(), notes: z.string().max(50_000).optional(), project_id: z.number().int().nullable().optional(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), due_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  estimate: z.number().int().min(1).max(1440).nullable().optional(), priority: z.number().int().min(-1).max(1).optional(), repeat: z.string().max(40).nullable().optional(),
  tags: z.string().max(300).optional(), status: Status.optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), focus: z.boolean().optional(),
});
/** Autosave from the task editor. Returns an error string instead of throwing so the UI can show it inline. */
export async function patchTask(id: number, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { tags, ...p } = Patch.parse(raw);
    if (!updateTask(id, { ...p, ...(tags !== undefined ? { tags: parseTags(tags) } : {}) })) return { ok: false, error: "Task not found" };
    refresh();
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof z.ZodError ? "Check the highlighted fields" : (e as Error).message }; }
}
export async function triage(id: number, action: "today" | "tomorrow" | "nextweek" | "someday" | "done" | "drop"): Promise<{ id: number; title: string; action: string } | null> {
  const t = getTask(id); if (!t) return null;
  if (action === "done") completeTask(id); else if (action === "drop") softDelete(id); else reschedule(id, action === "someday" ? "none" : action);
  refresh();
  return { id, title: t.title, action };
}

// ---------- projects ----------
export async function addProject(fd: FormData) {
  const name = str(fd, "name");
  if (!name) return;
  db.prepare("INSERT INTO projects (name, color) VALUES (?,?)").run(name, /^#[0-9a-f]{6}$/i.test(str(fd, "color")) ? str(fd, "color") : "#1877f2");
  refresh();
}
export async function archiveProject(id: number) { db.prepare("UPDATE projects SET archived=1 WHERE id=?").run(id); refresh(); redirect("/"); }

// ---------- focus ----------
export async function logFocus(seconds: number, kind: "focus" | "break", taskId: number | null, label: string) {
  logFocusLib({ seconds: z.number().positive().parse(seconds), kind: z.enum(["focus", "break"]).parse(kind), task_id: taskId, label: String(label).slice(0, 200) });
  revalidatePath("/");
}

export async function saveTimezone(fd: FormData) {
  const t = str(fd, "timezone");
  try { new Intl.DateTimeFormat("en-CA", { timeZone: t }); } catch { redirect("/settings?err=" + encodeURIComponent(`Unknown timezone "${t}"`)); }
  setSetting("timezone", t);
  refresh();
}
export async function setFeatureAction(key: string, on: boolean) {
  if (!isFeature(key)) throw new Error("Unknown feature");
  setFeature(key as FeatureKey, !!on);
  refresh();
}
export async function resetFeatures() { for (const f of FEATURES) setFeature(f.key, featureDefault(f.key)); refresh(); }
export async function saveCapacity(fd: FormData) { const h = Number(fd.get("hours")); if (h >= 1 && h <= 16) setSetting("capacity_min", String(Math.round(h * 60))); refresh(); }

// ---------- integrations ----------
export async function createTokenAction(name: string, o: { level?: "read" | "write"; areas?: string[]; days?: number } = {}): Promise<string> { const t = createToken(name, { level: o.level, areas: o.areas, days: o.days }); revalidatePath("/settings"); return t; }
export async function revokeTokenAction(id: number) { revokeToken(id); revalidatePath("/settings"); }
export async function regenerateIcal() { icalSecret(true); revalidatePath("/settings"); }
export async function regenerateInbound() { inboundSecret(true); revalidatePath("/settings"); }
export async function saveNotifySettings(fd: FormData) {
  const url = str(fd, "ntfy_url"), hook = str(fd, "webhook_url");
  for (const u of [url, hook]) if (u && !/^https?:\/\//i.test(u)) redirect("/settings?err=" + encodeURIComponent("URLs must start with http:// or https://"));
  setSetting("ntfy_url", url || null); setSetting("ntfy_topic", str(fd, "ntfy_topic") || null); setSetting("webhook_url", hook || null);
  if (str(fd, "ntfy_token")) setSetting("ntfy_token", str(fd, "ntfy_token"));
  const t = (k: string) => { const v = str(fd, k); setSetting(k, /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : v === "" ? "" : getSetting(k) ?? null); };
  t("brief_time");
  refresh();
}
export async function testNotification(): Promise<string> {
  const c = notifyConfigured();
  if (!c.ntfy && !c.webhook) return "Nothing configured yet. Add an ntfy topic or a webhook URL first.";
  const r = await notify({ title: "LifeOS test", body: "If you can read this, reminders will reach you.", click: "/", tags: ["white_check_mark"] });
  return Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(" · ");
}
export async function saveVoiceProject(fd: FormData) { const id = Number(str(fd, "project")) || 0; setSetting("voice_project", id ? String(id) : ""); refresh(); redirect("/settings?tab=connect#extension"); }
// ---------- layout customization ----------
export async function saveMobileTabs(hrefs: string[]) {
  const ok = [...NAV, SETTINGS_PAGE].map((p) => p.href), clean = [...new Set(hrefs)].filter((h) => ok.includes(h) || /^\/projects\/\d+$/.test(h)).slice(0, MAX_TABS);
  setSetting("mobile_tabs", JSON.stringify(clean)); refresh();
}
export async function resetMobileTabs() { setSetting("mobile_tabs", null); refresh(); }
export async function saveTodayWidgets(order: string[], hidden: string[]) {
  const ids = WIDGETS.map((w) => w.id);
  setSetting("today_widgets", JSON.stringify({ order: order.filter((i) => ids.includes(i)), hidden: hidden.filter((i) => ids.includes(i)) })); refresh();
}
export async function resetTodayWidgets() { setSetting("today_widgets", null); refresh(); }
