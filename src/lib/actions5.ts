"use server";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { parseImport, runImport, type ImportFile, type ImportResult } from "./importer";
import { deleteTag, pruneUnusedTags, renameTag, setTagColor } from "./tags";
import { addLink, removeLink, type LinkKind } from "./links";
import { setEntityTags, type TagKind } from "./entitytags";
import { createNote, moveNote, restoreNoteVersion, updateNote } from "./notes";
import { toggleFavourite, type FavKind } from "./favourites";
import { PROJECT_VIEWS } from "./projectviews";
import { redirect } from "next/navigation";
import { setSetting } from "./settings";
import { completeTask, reopenTask } from "./tasks";
import { createToken } from "./tokens";
import { deleteAttachment } from "./attachments";
import { deleteField, moveField, saveField, setFieldValue, type FieldInput } from "./fields";
import { deleteRule, runBoardAutomations, saveRule, type RuleInput } from "./automations";
import { parsePrefs } from "./sidebar";
import { createTask, deleteTask, getTask, moveCard, parseQuickAdd, parseTags, queryTasks, reschedule, setStatus, setTaskOrder, updateTask } from "./tasks";
import { today } from "./time";
import { listStatuses } from "./statuses";
import { addColumn, customizeProject, deleteColumn, moveColumn, renameColumn, resetProject, setColumnKind, type Kind } from "./statuses";

type R = { ok: true; message?: string } | { ok: false; error: string };
const run = (f: () => string | void): R => { try { const m = f(); revalidatePath("/", "layout"); return { ok: true, message: m || undefined }; } catch (e) { return { ok: false, error: (e as Error).message }; } };
export async function addColumnAction(projectId: number | null, name: string, kind: Kind): Promise<R> { return run(() => { addColumn(projectId, name, kind); }); }
export async function renameColumnAction(id: number, name: string): Promise<R> { return run(() => renameColumn(id, name)); }
export async function setColumnKindAction(id: number, kind: Kind): Promise<R> { return run(() => setColumnKind(id, kind)); }
export async function moveColumnAction(id: number, dir: -1 | 1): Promise<R> { return run(() => moveColumn(id, dir)); }
export async function deleteColumnAction(id: number, moveToId?: number): Promise<R> { return run(() => { const r = deleteColumn(id, moveToId); return r.moved ? `${r.moved} task${r.moved === 1 ? "" : "s"} moved` : "Column removed"; }); }
export async function useOwnColumnsAction(projectId: number, on: boolean): Promise<R> { return run(() => { if (on) customizeProject(projectId); else resetProject(projectId); return on ? "This project now has its own columns" : "Back to the default columns"; }); }

/** Add a card straight into a column. Quick-add words work ("Call vet friday #pets !high"). On a project's board the card belongs to that project. */
export async function addCardAction(title: string, columnKey: string, projectId: number | null): Promise<R> {
  return run(() => {
    const text = title.trim(); if (!text) throw new Error("Type a title first");
    const p = parseQuickAdd(text); if (!p.title) throw new Error("Type a title first");
    if (projectId && !p.project) p.project_id = projectId;
    const col = listStatuses(projectId).find((c) => c.key === columnKey); if (!col) throw new Error("That column no longer exists");
    const id = createTask({ ...p, status: col.kind === "done" ? undefined : col.key, source: "manual" });
    if (col.kind === "done") setStatus(id, col.key);
  });
}
export async function saveBoardDoneDays(days: number): Promise<R> { return run(() => { setSetting("board_done_days", String(Math.max(0, Math.min(365, Math.floor(days) || 0)))); }); }

/** Save the sidebar layout. Validated on the way in, so a bad request can't break navigation. */
export async function saveSidebarAction(prefs: unknown): Promise<R> { return run(() => { setSetting("sidebar", JSON.stringify(parsePrefs(JSON.stringify(prefs)))); }); }
export async function resetSidebarAction(): Promise<R> { return run(() => { setSetting("sidebar", null); return "Sidebar back to the default order"; }); }

export async function saveTagsAction(kind: TagKind, id: number, text: string): Promise<R> { return run(() => { if (!["note", "goal"].includes(kind)) throw new Error("Can't tag that"); setEntityTags(kind, id, parseTags(text)); }); }
export async function setNoteProjectAction(id: number, projectId: number | null): Promise<R> { return run(() => { updateNote(id, { project_id: projectId }); }); }
export async function restoreNoteVersionAction(noteId: number, versionId: number): Promise<R> { return run(() => { if (!restoreNoteVersion(noteId, versionId)) throw new Error("That version is gone"); return "Restored. The text it replaced is kept as a version."; }); }
export async function renameProjectAction(id: number, name: string, color: string, icon?: string, area?: string, view?: string): Promise<R> {
  return run(() => { const n = name.replace(/\s+/g, " ").trim(); if (!n || n.length > 60) throw new Error("Give the project a name (up to 60 characters)"); if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Pick a colour");
    if (db.prepare("SELECT 1 FROM projects WHERE lower(name)=lower(?) AND id!=? AND archived=0").get(n, id)) throw new Error("Another project already has that name"); db.prepare("UPDATE projects SET name=?, color=? WHERE id=?").run(n, color, id); if (icon !== undefined) db.prepare("UPDATE projects SET icon=? WHERE id=?").run(cleanIcon(icon), id); if (view !== undefined) db.prepare("UPDATE projects SET default_view=? WHERE id=?").run(PROJECT_VIEWS.includes(view) ? (view === "overview" ? "" : view) : "", id); if (area !== undefined) db.prepare("UPDATE projects SET area=? WHERE id=?").run(area.replace(/\s+/g, " ").trim().slice(0, 40), id); return "Saved"; });
}
export async function unarchiveProjectAction(id: number): Promise<R> { return run(() => { db.prepare("UPDATE projects SET archived=0 WHERE id=?").run(id); return "Project restored"; }); }

export async function newNoteInProjectAction(projectId: number) { const id = createNote("", "", projectId); revalidatePath("/", "layout"); redirect(`/notes/${id}`); }

/** Persist a drag-to-reorder of tasks within one list. */
export async function setOrderAction(ids: number[]): Promise<R> { return run(() => { if (!Array.isArray(ids) || ids.length > 1000) throw new Error("Bad order"); setTaskOrder(ids.map(Number)); }); }
/** Persist dropping a card into a column at a position. */
export async function moveCardAction(id: number, columnKey: string, ordered: number[]): Promise<R> { return run(() => { if (!Array.isArray(ordered) || ordered.length > 1000) throw new Error("Bad order"); moveCard(Number(id), String(columnKey), ordered.map(Number)); }); }

export async function addLinkAction(ak: LinkKind, ai: number, bk: LinkKind, bi: number): Promise<R> { return run(() => { addLink(ak, Number(ai), bk, Number(bi)); }); }
export async function removeLinkAction(ak: LinkKind, ai: number, bk: LinkKind, bi: number): Promise<R> { return run(() => { removeLink(ak, Number(ai), bk, Number(bi)); }); }

export async function renameTagAction(from: string, to: string): Promise<R> { return run(() => { const r = renameTag(from, to); return r.merged ? `Merged into #${to.replace(/^#/, "")}` : "Renamed"; }); }
export async function deleteTagAction(name: string): Promise<R> { return run(() => { const n = deleteTag(name); return n ? `Removed from ${n} item${n === 1 ? "" : "s"}` : "Deleted"; }); }
export async function setTagColorAction(name: string, color: string | null): Promise<R> { return run(() => { setTagColor(name, color); }); }
export async function pruneTagsAction(): Promise<R> { return run(() => { const n = pruneUnusedTags(); return n ? `Removed ${n} unused tag${n === 1 ? "" : "s"}` : "No unused tags"; }); }

export type ImportSummary = { formats: string[]; tasks: number; subtasks: number; notes: number; done: number; sample: { title: string; project: string | null; due: string | null }[]; noteTitles: string[]; warnings: string[] };
const clean = (files: unknown): ImportFile[] => (Array.isArray(files) ? files : []).slice(0, 300).map((f) => ({ name: String((f as ImportFile).name ?? "file").slice(0, 200), text: String((f as ImportFile).text ?? "").slice(0, 5_000_000) }));
/** Read the files and say what would be imported, without changing anything. */
export async function previewImportAction(files: ImportFile[], project: string): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  try { const p = parseImport(clean(files), { project }); return { ok: true, summary: { formats: p.formats, tasks: p.tasks.filter((t) => t.parent === null).length, subtasks: p.tasks.filter((t) => t.parent !== null).length, notes: p.notes.length, done: p.tasks.filter((t) => t.done).length, sample: p.tasks.slice(0, 6).map((t) => ({ title: t.title, project: t.project, due: t.due })), noteTitles: p.notes.slice(0, 6).map((n) => n.title), warnings: p.warnings } }; }
  catch (e) { return { ok: false, error: (e as Error).message }; }
}
export async function runImportAction(files: ImportFile[], project: string): Promise<{ ok: true; result: ImportResult } | { ok: false; error: string }> {
  try { const r = runImport(parseImport(clean(files), { project })); revalidatePath("/", "layout"); return { ok: true, result: r }; } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export type BulkOp = { op: "move"; column: string } | { op: "priority"; value: -1 | 0 | 1 } | { op: "tag"; tag: string } | { op: "delete" };
/** Change several cards at once. Each is applied on its own, so one failure doesn't stop the rest. */
export async function bulkBoardAction(ids: number[], o: BulkOp): Promise<R> {
  return run(() => {
    const list = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200); if (!list.length) throw new Error("Select some cards first");
    let n = 0, bad = 0;
    for (const id of list) {
      try {
        if (o.op === "move") setStatus(id, o.column); else if (o.op === "priority") updateTask(id, { priority: o.value }); else if (o.op === "delete") deleteTask(id);
        else if (o.op === "tag") { const t = getTask(id); if (t) updateTask(id, { tags: [...new Set([...t.tags, ...parseTags(o.tag)])] }); }
        n++;
      } catch { bad++; }
    }
    return `${n} card${n === 1 ? "" : "s"} updated${bad ? `, ${bad} couldn't be changed` : ""}`;
  });
}

/** An emoji or a couple of characters. Anything longer is cut, so a paste can't fill the sidebar. */
const cleanIcon = (v: string) => Array.from(v.trim()).slice(0, 8).join("");
export async function moveTaskToProjectAction(taskId: number, projectId: number | null): Promise<R> {
  return run(() => { const p = projectId ? (db.prepare("SELECT name FROM projects WHERE id=? AND archived=0").get(projectId) as { name: string } | undefined) : undefined; if (projectId && !p) throw new Error("That project is gone");
    if (!updateTask(taskId, { project_id: projectId })) throw new Error("That task is gone"); return p ? `Moved to ${p.name}` : "Moved to the inbox"; });
}
export async function saveBrowserNotifyAction(on: boolean, lead: number, snooze: number): Promise<R> {
  return run(() => { const l = Math.min(120, Math.max(0, Math.round(Number(lead) || 0))), s = Math.min(240, Math.max(1, Math.round(Number(snooze) || 15))); setSetting("notify_browser", on ? "1" : "0"); setSetting("notify_lead", String(l)); setSetting("notify_snooze", String(s)); return "Saved"; });
}
/** Save a new order for some projects (the ones in one area, top to bottom). Everything else keeps its place. */
export async function reorderProjectsAction(ids: number[]): Promise<R> {
  return run(() => { const clean = ids.filter((n) => Number.isInteger(n)); const st = db.prepare("UPDATE projects SET position=? WHERE id=?"); db.transaction(() => clean.forEach((id, i) => st.run(i + 1, id)))(); });
}
/** Nudge one project up or down within its area (for keyboards and phones, where dragging is awkward). */
/** Put a project in an area (empty = "Other"), just before another project there, or at the end. */
export async function moveProjectToAreaAction(id: number, area: string, beforeId: number | null): Promise<R> {
  return run(() => { const a = area.replace(/\s+/g, " ").trim().slice(0, 40); if (!db.prepare("SELECT 1 FROM projects WHERE id=?").get(id)) throw new Error("That project is gone");
    db.transaction(() => { db.prepare("UPDATE projects SET area=? WHERE id=?").run(a, id);
      const ids = (db.prepare("SELECT id FROM projects WHERE archived=0 AND area=? AND id!=? ORDER BY position, name COLLATE NOCASE").all(a, id) as { id: number }[]).map((r) => r.id), at = beforeId ? ids.indexOf(beforeId) : -1; ids.splice(at < 0 ? ids.length : at, 0, id);
      const st = db.prepare("UPDATE projects SET position=? WHERE id=?"); ids.forEach((pid, i) => st.run(i + 1, pid)); })(); });
}
export async function moveProjectAction(id: number, dir: -1 | 1): Promise<R> {
  return run(() => { const p = db.prepare("SELECT area FROM projects WHERE id=?").get(id) as { area: string } | undefined; if (!p) throw new Error("That project is gone");
    const peers = (db.prepare("SELECT id FROM projects WHERE archived=0 AND area=? ORDER BY position, name COLLATE NOCASE").all(p.area) as { id: number }[]).map((r) => r.id), i = peers.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= peers.length) return; [peers[i], peers[j]] = [peers[j], peers[i]]; const st = db.prepare("UPDATE projects SET position=? WHERE id=?"); db.transaction(() => peers.forEach((pid, k) => st.run(k + 1, pid)))(); });
}
export async function rescheduleOverdueAction(to: "today" | "tomorrow" | "nextweek"): Promise<R> {
  return run(() => { if (!["today", "tomorrow", "nextweek"].includes(to)) throw new Error("Pick today, tomorrow or next week"); const t = today(), late = queryTasks({}).filter((x) => x.due && x.due < t && !x.parent_id);
    db.transaction(() => { for (const x of late) reschedule(x.id, to); })(); return late.length ? `Moved ${late.length} task${late.length === 1 ? "" : "s"} to ${to === "nextweek" ? "next week" : to}` : "Nothing overdue"; });
}
export async function toggleFavouriteAction(kind: FavKind, id: number): Promise<R> { return run(() => (toggleFavourite(kind, id) ? "Added to favourites" : "Removed from favourites")); }
export async function moveNoteAction(id: number, parentId: number | null): Promise<R> { return run(() => { const e = moveNote(id, parentId); if (e) throw new Error(e); return "Moved"; }); }
export async function newSubpageAction(parentId: number) { const id = createNote("", "", null, parentId); revalidatePath("/", "layout"); redirect(`/notes/${id}`); }
export async function setNoteIconAction(id: number, icon: string): Promise<R> { return run(() => { db.prepare("UPDATE notes SET icon=? WHERE id=?").run(cleanIcon(icon), id); }); }

// ---------- board automations ----------
export async function saveRuleAction(i: RuleInput): Promise<R> { return run(() => { saveRule(i); const n = runBoardAutomations({ force: true }); return n ? `Saved. ${n} card${n === 1 ? "" : "s"} moved now` : "Saved"; }); }
export async function deleteRuleAction(id: number): Promise<R> { return run(() => { deleteRule(id); return "Automation removed"; }); }
export async function deleteAttachmentAction(id: number): Promise<R> { return run(() => { deleteAttachment(id); }); }

// ---------- custom fields ----------
export async function saveFieldAction(i: FieldInput): Promise<R> { return run(() => { saveField(i); return "Saved"; }); }
export async function deleteFieldAction(id: number): Promise<R> { return run(() => { deleteField(id); return "Field removed"; }); }
export async function moveFieldAction(id: number, dir: -1 | 1): Promise<R> { return run(() => { moveField(id, dir); }); }
export async function setFieldValueAction(taskId: number, fieldId: number, value: string): Promise<R> { return run(() => { setFieldValue(taskId, fieldId, value); }); }

// ---------- offline sync (idempotent forms of tick and move, so replaying them is safe) ----------
export async function setDoneAction(id: number, done: boolean): Promise<R> { return run(() => { const t = getTask(id); if (!t) throw new Error("Task not found"); if (done && !t.done_at) completeTask(id); else if (!done && t.done_at) reopenTask(id); }); }
export async function moveTask(id: number, status: string): Promise<R> { return run(() => { if (!getTask(id)) throw new Error("Task not found"); setStatus(id, status); }); }

/** The Chrome extension asks for a key of its own: write access to tasks and voice, valid for a year, revocable in Settings. Shown once, to the page the signed-in person is looking at. */
export async function createExtensionToken(label: string): Promise<{ token: string }> {
  const name = `Chrome extension${label ? ` (${label.replace(/[^\w .-]/g, "").slice(0, 30)})` : ""} · ${new Date().toISOString().slice(0, 10)}`;
  const token = createToken(name, { level: "write", areas: ["tasks", "voice"], days: 365 });
  revalidatePath("/settings");
  return { token };
}
