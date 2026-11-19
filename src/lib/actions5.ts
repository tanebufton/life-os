"use server";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { setEntityTags, parseTags, type TagKind } from "./entitytags";
import { createNote, restoreNoteVersion, updateNote } from "./notes";
import { redirect } from "next/navigation";
import { setSetting } from "./settings";
import { parsePrefs } from "./sidebar";
import { createTask, parseQuickAdd, setStatus } from "./tasks";
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

export async function saveTagsAction(kind: TagKind, id: number, text: string): Promise<R> { return run(() => { if (!["note", "goal", "person"].includes(kind)) throw new Error("Can't tag that"); setEntityTags(kind, id, parseTags(text)); }); }
export async function setNoteProjectAction(id: number, projectId: number | null): Promise<R> { return run(() => { updateNote(id, { project_id: projectId }); }); }
export async function restoreNoteVersionAction(noteId: number, versionId: number): Promise<R> { return run(() => { if (!restoreNoteVersion(noteId, versionId)) throw new Error("That version is gone"); return "Restored. The text it replaced is kept as a version."; }); }
export async function renameProjectAction(id: number, name: string, color: string): Promise<R> {
  return run(() => { const n = name.replace(/\s+/g, " ").trim(); if (!n || n.length > 60) throw new Error("Give the project a name (up to 60 characters)"); if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Pick a colour");
    if (db.prepare("SELECT 1 FROM projects WHERE lower(name)=lower(?) AND id!=? AND archived=0").get(n, id)) throw new Error("Another project already has that name"); db.prepare("UPDATE projects SET name=?, color=? WHERE id=?").run(n, color, id); return "Saved"; });
}
export async function unarchiveProjectAction(id: number): Promise<R> { return run(() => { db.prepare("UPDATE projects SET archived=0 WHERE id=?").run(id); return "Project restored"; }); }

export async function newNoteInProjectAction(projectId: number) { const id = createNote("", "", projectId); revalidatePath("/", "layout"); redirect(`/notes/${id}`); }
