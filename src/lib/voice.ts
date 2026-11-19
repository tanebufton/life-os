import { db } from "./db";
import { createNote } from "./notes";
import { enrichLinkTask } from "./misc";
import { createTask, getTask, parseQuickAdd } from "./tasks";

export type Memo = { id: number; text: string; source: string; task_id: number | null; note_id: number | null; created_at: string };
export type MemoAs = "memo" | "task" | "note";
const clean = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 5000);
export const listMemos = (limit = 50) => db.prepare("SELECT id, text, source, task_id, note_id, created_at FROM voice_memos WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ?").all(limit) as Memo[];
export const getMemo = (id: number) => db.prepare("SELECT id, text, source, task_id, note_id, created_at FROM voice_memos WHERE id=? AND deleted_at IS NULL").get(id) as Memo | undefined;
/** Save a transcript. `as` decides what it also becomes: nothing (memo only), a task (parsed with quick-add syntax, so "call mum tomorrow at 5" works) or a note. */
export function saveMemo(text: string, as: MemoAs = "memo", source = "web"): Memo {
  const t = clean(text); if (!t) throw new Error("Nothing to save: the transcript is empty");
  const id = Number(db.prepare("INSERT INTO voice_memos (text, source) VALUES (?,?)").run(t, source).lastInsertRowid);
  if (as !== "memo") convertMemo(id, as);
  return getMemo(id)!;
}
export function convertMemo(id: number, as: Exclude<MemoAs, "memo">): Memo | undefined {
  const m = getMemo(id); if (!m) return undefined;
  if (as === "task") { const tid = createTask({ ...parseQuickAdd(m.text), source: "voice" }); db.prepare("UPDATE voice_memos SET task_id=? WHERE id=?").run(tid, id); void enrichLinkTask(tid); }
  else { const first = m.text.split(/(?<=[.!?])\s/)[0].slice(0, 60); const nid = createNote(`Voice memo: ${first}`.replace(/\s+$/, ""), m.text + "\n"); db.prepare("UPDATE voice_memos SET note_id=? WHERE id=?").run(nid, id); }
  return getMemo(id);
}
export const deleteMemo = (id: number) => db.prepare("UPDATE voice_memos SET deleted_at=datetime('now') WHERE id=?").run(id).changes > 0;
export const memoTask = (m: Memo) => (m.task_id ? getTask(m.task_id) : undefined);
