"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "./db";
import { FEATURES, featureDefault, isFeature, setFeature, type FeatureKey } from "./features";
import { logFocus as logFocusLib } from "./focus";
import { archiveHabit, createHabit, toggleHabit } from "./habits";
import { saveEntry } from "./journal";
import { assertPublicUrl } from "./news";
import { notify, notifyConfigured } from "./notify";
import { getSetting, setSetting } from "./settings";
import { control, disconnectSpotify, type Action } from "./spotify";
import { createTask, completeTask, deleteTask as softDelete, duplicateTask, getTask, parseQuickAdd, parseTags, reopenTask, reschedule, restoreTask, setStatus, updateTask, type Status } from "./tasks";
import { createToken, icalSecret, inboundSecret, revokeToken } from "./tokens";
import { geocode } from "./weather";
import { mapBankCsv } from "./csv";
import { addRule, addStarterCategories, addTransaction, archiveCategory, archiveSaving, categoryByName, contributeSaving, createCategory, createSaving, deleteTransaction, importRows, listCategories, setBudget, updateTransaction } from "./money";
import { parseMoneyQuick, toCents } from "./moneyfmt";
import { CYCLES, createSub, markPaid, setSubStatus, updateSub, type Cycle, type Sub } from "./subs";
import { today } from "./time";
import { enrichLinkTask } from "./misc";
import { deleteSubRow } from "./subs2";
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
export async function addSubtask(parentId: number, title: string) { const t = title.trim(); if (t) createTask({ title: t, parent_id: parentId }); refresh(); }

const Patch = z.object({
  title: z.string().trim().min(1).max(500).optional(), notes: z.string().max(50_000).optional(), project_id: z.number().int().nullable().optional(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), due_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  estimate: z.number().int().min(1).max(1440).nullable().optional(), priority: z.number().int().min(-1).max(1).optional(), repeat: z.string().max(40).nullable().optional(),
  tags: z.string().max(300).optional(), status: Status.optional(),
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

// ---------- habits & journal ----------
export async function addHabit(fd: FormData) {
  const name = str(fd, "name"); if (!name) return;
  const days = fd.getAll("days").map(Number).filter((n) => n >= 0 && n <= 6);
  createHabit(name, { color: str(fd, "color"), days: days.length ? days : undefined });
  refresh();
}
export async function toggleHabitAction(id: number, date?: string) { const r = toggleHabit(id, date); refresh(); return r; }
export async function archiveHabitAction(id: number) { archiveHabit(id); refresh(); }
export async function saveJournal(date: string, patch: { mood?: number | null; body?: string }) { saveEntry(date, patch); revalidatePath("/journal"); revalidatePath("/"); }

// ---------- focus ----------
export async function logFocus(seconds: number, kind: "focus" | "break", taskId: number | null, label: string) {
  logFocusLib({ seconds: z.number().positive().parse(seconds), kind: z.enum(["focus", "break"]).parse(kind), task_id: taskId, label: String(label).slice(0, 200) });
  revalidatePath("/");
}

// ---------- settings ----------
export async function saveLocation(fd: FormData) {
  const q = str(fd, "place");
  if (!q) { for (const k of ["place", "lat", "lon"]) setSetting(k, null); refresh(); return; }
  const g = await geocode(q);
  if (!g) redirect("/settings?err=" + encodeURIComponent(`Couldn't find "${q}"`));
  setSetting("place", g.place); setSetting("lat", String(g.lat)); setSetting("lon", String(g.lon));
  if (!str(fd, "keep_tz")) setSetting("timezone", g.timezone);
  refresh();
}
export async function saveTimezone(fd: FormData) {
  const t = str(fd, "timezone");
  try { new Intl.DateTimeFormat("en-CA", { timeZone: t }); } catch { redirect("/settings?err=" + encodeURIComponent(`Unknown timezone "${t}"`)); }
  setSetting("timezone", t);
  refresh();
}
export async function addFeed(fd: FormData) {
  try { const url = assertPublicUrl(str(fd, "url")).toString(); db.prepare("INSERT OR IGNORE INTO feeds (url, title) VALUES (?,?)").run(url, str(fd, "title")); }
  catch (e) { redirect("/settings?err=" + encodeURIComponent((e as Error).message)); }
  refresh();
}
export async function removeFeed(id: number) { db.prepare("DELETE FROM feeds WHERE id=?").run(id); refresh(); }
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
  t("brief_time"); t("habit_nudge_time");
  refresh();
}
export async function testNotification(): Promise<string> {
  const c = notifyConfigured();
  if (!c.ntfy && !c.webhook) return "Nothing configured yet. Add an ntfy topic or a webhook URL first.";
  const r = await notify({ title: "LifeOS test", body: "If you can read this, reminders will reach you.", click: "/", tags: ["white_check_mark"] });
  return Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(" · ");
}
export async function spotifyControl(action: Action): Promise<string> { return control(z.enum(["play", "pause", "toggle", "next", "previous"]).parse(action)); }
export async function spotifyDisconnect() { disconnectSpotify(); refresh(); }

// ---------- money ----------
const cents = (v: unknown) => { const n = Number(String(v ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) ? toCents(n) : NaN; };
export async function quickSpend(text: string): Promise<string> {
  const q = parseMoneyQuick(text, today(), listCategories().map((c) => c.name));
  if (!q) return "Not a money entry";
  const cat = q.category ? categoryByName(q.category, true) : undefined;
  addTransaction({ date: q.date, amount_cents: q.amount_cents, payee: q.payee, category_id: cat === null ? undefined : cat, source: "quick" });
  revalidatePath("/money"); refresh();
  return `${q.amount_cents < 0 ? "Spent" : "Received"} ${(Math.abs(q.amount_cents) / 100).toFixed(2)}${q.payee ? " · " + q.payee : ""}`;
}
export async function addTransactionAction(fd: FormData) {
  const amt = cents(fd.get("amount")); if (!Number.isFinite(amt) || amt === 0) return;
  const income = str(fd, "kind") === "income";
  addTransaction({ date: str(fd, "date") || undefined, amount_cents: income ? Math.abs(amt) : -Math.abs(amt), payee: str(fd, "payee"), category_id: Number(fd.get("category_id")) || undefined, note: str(fd, "note") });
  refresh();
}
export async function updateTxCategory(id: number, categoryId: number | null, rulePattern?: string) {
  updateTransaction(id, { category_id: categoryId });
  if (categoryId && rulePattern?.trim()) addRule(rulePattern, categoryId);
  refresh();
}
export async function deleteTxAction(id: number) { deleteTransaction(id); refresh(); }
export async function setBudgetAction(catId: number, month: string, dollars: number, everyMonth: boolean) { if (!/^\d{4}-\d{2}$/.test(month)) return; setBudget(catId, month, toCents(dollars), everyMonth); refresh(); }
export async function addCategoryAction(fd: FormData) { const n = str(fd, "name"); if (!n) return; createCategory(n, { kind: str(fd, "kind") === "income" ? "income" : "expense", color: str(fd, "color"), budget_cents: Math.max(0, cents(fd.get("budget")) || 0) }); refresh(); }
export async function archiveCategoryAction(id: number) { archiveCategory(id); refresh(); }
export async function addStarterCategoriesAction() { addStarterCategories(); refresh(); }
export async function previewCsv(text: string, dayFirst: boolean, invert: boolean) { const r = mapBankCsv(text, { dayFirst, invert }); return { count: r.rows.length, skipped: r.skipped, columns: r.columns, sample: r.rows.slice(0, 6) }; }
export async function importCsv(text: string, dayFirst: boolean, invert: boolean) { const r = mapBankCsv(text, { dayFirst, invert }); const out = importRows(r.rows); refresh(); return { ...out, skipped: r.skipped }; }
export async function addSavingAction(fd: FormData) { const n = str(fd, "name"), t = cents(fd.get("target")); if (!n || !(t > 0)) return; createSaving(n, t, str(fd, "due") || null, str(fd, "color") || undefined); refresh(); }
export async function contributeAction(id: number, dollars: number) { contributeSaving(id, toCents(dollars)); refresh(); }
export async function archiveSavingAction(id: number) { archiveSaving(id); refresh(); }
export async function saveCurrency(fd: FormData) { const c = str(fd, "currency").toUpperCase(); if (/^[A-Z]{3}$/.test(c)) { try { new Intl.NumberFormat("en", { style: "currency", currency: c }); setSetting("currency", c); } catch { redirect("/settings?err=" + encodeURIComponent(`Unknown currency "${c}"`)); } } refresh(); }

// ---------- subscriptions ----------
export async function addSubAction(fd: FormData) {
  const amt = cents(fd.get("amount")); const name = str(fd, "name"); if (!name || !(amt >= 0)) return;
  const cycle = (CYCLES.includes(str(fd, "cycle") as Cycle) ? str(fd, "cycle") : "monthly") as Cycle;
  createSub({ name, amount_cents: amt, cycle, next_due: str(fd, "next_due") || undefined, trial_ends: str(fd, "trial_ends") || null, url: str(fd, "url"), category_id: Number(fd.get("category_id")) || null, auto_log: fd.get("auto_log") !== null, remind_days: Number(fd.get("remind_days")) || 3, color: str(fd, "color") || undefined });
  refresh();
}
export async function updateSubAction(id: number, patch: Partial<Pick<Sub, "name" | "next_due" | "url" | "notes" | "remind_days" | "auto_log">> & { amount?: number }) { const { amount, ...p } = patch; updateSub(id, { ...p, ...(amount !== undefined ? { amount_cents: toCents(amount) } : {}) }); refresh(); }
export async function setSubStatusAction(id: number, status: Sub["status"]) { setSubStatus(id, status); refresh(); }
export async function markPaidAction(id: number) { markPaid(id); refresh(); }
export async function deleteSubAction(id: number) { deleteSubRow(id); refresh(); }

// ---------- layout customization ----------
export async function saveMobileTabs(hrefs: string[]) {
  const ok = [...NAV, SETTINGS_PAGE].map((p) => p.href), clean = [...new Set(hrefs)].filter((h) => ok.includes(h)).slice(0, MAX_TABS);
  setSetting("mobile_tabs", JSON.stringify(clean)); refresh();
}
export async function resetMobileTabs() { setSetting("mobile_tabs", null); refresh(); }
export async function saveTodayWidgets(order: string[], hidden: string[]) {
  const ids = WIDGETS.map((w) => w.id);
  setSetting("today_widgets", JSON.stringify({ order: order.filter((i) => ids.includes(i)), hidden: hidden.filter((i) => ids.includes(i)) })); refresh();
}
export async function resetTodayWidgets() { setSetting("today_widgets", null); refresh(); }
