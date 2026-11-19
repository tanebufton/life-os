import { db } from "./db";
import { addDays, diffDays } from "./dates";
import { queryTasks, type TaskRow } from "./tasks";

export type Suggestions = { recent: TaskRow[]; postponed: (TaskRow & { moves: number })[]; stale: TaskRow[]; soon: TaskRow[] };
/** Where to start: new tasks with no date, ones you keep pushing back, long-overdue ones, and what's due in the next couple of days. */
export function suggestions(t: string): Suggestions {
  const open = queryTasks().filter((x) => !x.parent_id);
  const made = new Map((db.prepare("SELECT id, created_at FROM tasks WHERE done_at IS NULL AND deleted_at IS NULL").all() as { id: number; created_at: string }[]).map((r) => [r.id, r.created_at.slice(0, 10)]));
  const moves = new Map((db.prepare("SELECT entity_id AS id, count(*) AS n FROM activity WHERE entity='task' AND action='changed' AND field='Due' AND old IS NOT NULL AND new IS NOT NULL AND new > old GROUP BY entity_id").all() as { id: number; n: number }[]).map((r) => [r.id, r.n]));
  const recent = open.filter((x) => !x.due && made.get(x.id) && diffDays(t, made.get(x.id)!) <= 1).slice(0, 8);
  const postponed = open.filter((x) => (moves.get(x.id) ?? 0) >= 2).map((x) => ({ ...x, moves: moves.get(x.id)! })).sort((a, b) => b.moves - a.moves).slice(0, 8);
  const stale = open.filter((x) => x.due && diffDays(t, x.due) > 7).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 8);
  const soon = open.filter((x) => x.due && x.due > t && x.due <= addDays(t, 2)).slice(0, 8);
  return { recent, postponed, stale, soon };
}
