"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addFeed as addCalFeed, removeFeed as removeCalFeed, syncAll, syncFeed } from "./calendar";
import { AiError, aiConfigured, ask, extractTasks, planDay, type Plan, type Proposal } from "./ai";
import { isOn } from "./features";
import { addKeyResult, createGoal, deleteGoal, deleteKeyResult, setGoalStatus, setKeyResult, type Goal } from "./goals";
import { addComment, deleteComment, emptyTrash, deleteFilter, purgeTask, saveFilter, enrichLinkTask } from "./misc";
import { createNote, deleteNote, getNote, noteByTitle, updateNote } from "./notes";
import { archivePerson, createPerson, followUpTask, logContact, updatePerson } from "./people";
import { autoSchedule, findSlot, toHm, workHours } from "./planner";
import { getSetting, setSetting } from "./settings";
import { tgConfigured, tgLinkCode, tgSecret, tgSend, tgSetWebhook, tgToken } from "./telegram";
import { createTask, getTask, reschedule, restoreTask, updateTask } from "./tasks";
import { createTemplate, deleteTemplate, installStarterTemplates, templateFromTask, useTemplate } from "./templates";
import { today } from "./time";
import { convertMemo, deleteMemo, saveMemo, type MemoAs } from "./voice";

const refresh = () => revalidatePath("/", "layout");
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const ok = <T,>(v: T) => ({ ok: true as const, ...v }), fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) });

// calendar feeds
export async function addCalFeedAction(fd: FormData) { try { const id = addCalFeed(s(fd, "name") || "Calendar", s(fd, "url"), s(fd, "color") || undefined); await syncFeed(id); } catch (e) { console.error(e); } refresh(); }
export async function removeCalFeedAction(id: number) { removeCalFeed(id); refresh(); }
export async function syncCalendarsAction() { await syncAll(); refresh(); }

// planner
export async function autoScheduleAction(date: string) { const r = autoSchedule(date); refresh(); return r; }
export async function scheduleTaskAction(id: number, date: string, hm?: string) {
  const t = getTask(id); if (!t) return;
  const at = hm ?? (findSlot(date, t.estimate ?? 30, date === today() ? Math.max(workHours().start, Math.ceil((Number(new Date().getHours()) * 60 + new Date().getMinutes()) / 15) * 15) : undefined)); if (at === null || at === undefined) return;
  updateTask(id, { due: date, due_time: typeof at === "number" ? toHm(at) : at }); refresh();
}
export async function unscheduleTaskAction(id: number) { updateTask(id, { due_time: null }); refresh(); }
export async function saveWorkHours(fd: FormData) { for (const k of ["work_start", "work_end"]) { const v = s(fd, k); if (/^\d{2}:\d{2}$/.test(v)) setSetting(k, v); } refresh(); }

// notes
export async function newNoteAction() { const id = createNote("", ""); refresh(); redirect(`/notes/${id}`); }
export async function saveNoteAction(id: number, p: { title?: string; body?: string; pinned?: boolean }) { const clash = p.title && noteByTitle(p.title); if (clash && clash.id !== id) return { ok: false as const, error: `A note called "${p.title}" already exists` }; updateNote(id, p); revalidatePath("/notes"); return { ok: true as const }; }
export async function deleteNoteAction(id: number) { deleteNote(id); refresh(); redirect("/notes"); }
export async function openNoteByTitle(title: string) { const n = noteByTitle(title) ?? getNote(createNote(title, "")); return n!.id; }

// goals
export async function addGoalAction(fd: FormData) { const t = s(fd, "title"); if (!t) return; createGoal({ title: t, area: s(fd, "area") || "General", target_date: s(fd, "target_date") || null }); refresh(); }
export async function goalStatusAction(id: number, st: Goal["status"]) { setGoalStatus(id, st); refresh(); }
export async function deleteGoalAction(id: number) { deleteGoal(id); refresh(); }
export async function addKrAction(goalId: number, fd: FormData) { try { addKeyResult(goalId, s(fd, "title"), Number(s(fd, "target")), s(fd, "unit")); } catch (e) { console.error(e); } refresh(); }
export async function setKrAction(id: number, v: number) { if (Number.isFinite(v)) setKeyResult(id, v); refresh(); }
export async function deleteKrAction(id: number) { deleteKeyResult(id); refresh(); }

// people
export async function addPersonAction(fd: FormData) { const n = s(fd, "name"); if (!n) return; createPerson({ name: n, birthday: s(fd, "birthday") || null, cadence_days: Number(s(fd, "cadence")) || null, notes: s(fd, "notes") }); refresh(); }
export async function logContactAction(id: number, note = "") { logContact(id, note); refresh(); }
export async function updatePersonAction(id: number, p: { name?: string; notes?: string; birthday?: string | null; cadence_days?: number | null }) { updatePerson(id, p); refresh(); }
export async function archivePersonAction(id: number) { archivePerson(id); refresh(); }
export async function followUpAction(id: number) { followUpTask(id); refresh(); }

// templates
export async function useTemplateAction(id: number) { const t = useTemplate(id, { due: today() }); refresh(); if (t) redirect(`/tasks/${t}`); }
export async function saveTemplateFromTask(taskId: number) { templateFromTask(taskId); refresh(); redirect("/templates"); }
export async function deleteTemplateAction(id: number) { deleteTemplate(id); refresh(); }
export async function installStarterTemplatesAction() { installStarterTemplates(); refresh(); }

// trash, filters, comments
export async function restoreFromTrash(id: number) { restoreTask(id); refresh(); }
export async function purgeFromTrash(id: number) { purgeTask(id); refresh(); }
export async function emptyTrashAction() { emptyTrash(); refresh(); }
export async function saveFilterAction(fd: FormData) { try { saveFilter(s(fd, "name"), s(fd, "query")); } catch (e) { console.error(e); } refresh(); }
export async function deleteFilterAction(id: number) { deleteFilter(id); refresh(); }
export async function addCommentAction(taskId: number, fd: FormData) { try { addComment(taskId, s(fd, "body")); } catch { /* empty */ } revalidatePath(`/tasks/${taskId}`); }
export async function deleteCommentAction(taskId: number, id: number) { deleteComment(id); revalidatePath(`/tasks/${taskId}`); }
export async function skipForNow(): Promise<void> { /* handled client side */ }

// bulk
export async function bulkAction(ids: number[], action: "done" | "today" | "tomorrow" | "nextweek" | "someday" | "delete" | "high") {
  const { completeTask, deleteTask } = await import("./tasks");
  for (const id of ids.slice(0, 200)) {
    if (!getTask(id)) continue;
    if (action === "done") completeTask(id); else if (action === "delete") deleteTask(id); else if (action === "high") updateTask(id, { priority: 1 });
    else reschedule(id, action === "someday" ? "none" : action);
  }
  refresh();
}

// quiet hours
export async function saveQuietHours(fd: FormData) { for (const k of ["quiet_start", "quiet_end"]) { const v = s(fd, k); setSetting(k, /^\d{2}:\d{2}$/.test(v) ? v : null); } refresh(); }

// telegram
export async function saveTelegramToken(fd: FormData) { const t = s(fd, "token"); if (t) setSetting("telegram_token", t); refresh(); }
export async function telegramConnect(origin: string) {
  try { if (!tgToken()) return fail(new Error("Add a bot token first.")); const r = await tgSetWebhook(`${origin.replace(/\/$/, "")}/api/telegram/${tgSecret()}`); return r.ok ? ok({ message: "Webhook set. Now send the link command to your bot." }) : fail(new Error(r.description || "Telegram refused the webhook")); } catch (e) { return fail(e); }
}
export async function telegramTest() { try { if (!tgConfigured()) return fail(new Error("Link your chat first (send the /start command to the bot).")); await tgSend(getSetting("telegram_chat_id")!, "LifeOS test message ✓"); return ok({ message: "Sent. Check Telegram." }); } catch (e) { return fail(e); } }
export async function telegramUnlink() { setSetting("telegram_chat_id", null); tgLinkCode(true); refresh(); }
export async function telegramRegen() { tgLinkCode(true); tgSecret(true); refresh(); }

// AI
const guardAi = () => { if (!isOn("ai")) throw new AiError("The AI assistant is switched off in Settings.", "config"); };
export async function aiExtract(text: string) { try { guardAi(); if (!text.trim()) return fail(new Error("Paste some text first.")); return ok({ tasks: await extractTasks(text) }); } catch (e) { return fail(e); } }
export async function aiAccept(items: Proposal[]) {
  let n = 0; const { db } = await import("./db");
  for (const p of items.slice(0, 25)) { const proj = p.project ? (db.prepare("SELECT id FROM projects WHERE lower(name)=lower(?) AND archived=0").get(p.project) as { id: number } | undefined) : undefined;
    const id = createTask({ title: p.title, due: p.due ?? undefined, due_time: p.time ?? undefined, priority: p.priority, estimate: p.estimate_minutes ?? undefined, project_id: proj?.id, tags: p.tags, notes: p.notes ?? undefined, source: "ai" } as never); n++; void enrichLinkTask(id); }
  refresh(); return n;
}
export async function aiPlan(date: string) { try { guardAi(); return ok({ plan: await planDay(date) }); } catch (e) { return fail(e); } }
export async function aiApplyPlan(plan: Plan, date: string) {
  for (const b of plan.blocks) updateTask(b.task_id, { due: date, due_time: b.start });
  for (const d of plan.defer) reschedule(d.task_id, d.to === "someday" ? "none" : d.to);
  refresh(); return plan.blocks.length + plan.defer.length;
}
export async function aiAsk(q: string) { try { guardAi(); if (!q.trim()) return fail(new Error("Ask something first.")); return ok({ answer: await ask(q) }); } catch (e) { return fail(e); } }
export const aiStatus = async () => ({ configured: aiConfigured() });

// voice
export async function saveMemoAction(text: string, as: MemoAs) { try { const m = saveMemo(text, as, "web"); refresh(); return ok({ id: m.id, task_id: m.task_id, note_id: m.note_id }); } catch (e) { return fail(e); } }
export async function convertMemoAction(id: number, as: "task" | "note") { convertMemo(id, as); refresh(); }
export async function deleteMemoAction(id: number) { deleteMemo(id); refresh(); }
