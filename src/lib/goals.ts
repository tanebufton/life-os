import { record } from "./activity";
import { db } from "./db";

export const AREAS = ["Health", "Career", "Money", "Relationships", "Learning", "Home", "Fun", "General"];
export type Goal = { id: number; title: string; area: string; target_date: string | null; project_id: number | null; description: string; status: "active" | "done" | "archived" };
export type KR = { id: number; goal_id: number; title: string; target: number; current: number; unit: string };
export const listGoals = (status: Goal["status"] = "active") => db.prepare("SELECT * FROM goals WHERE status=? ORDER BY target_date IS NULL, target_date, id").all(status) as Goal[];
export const getGoal = (id: number) => db.prepare("SELECT * FROM goals WHERE id=?").get(id) as Goal | undefined;
export function createGoal(g: { title: string; area?: string; target_date?: string | null; project_id?: number | null; description?: string }): number {
  if (!g.title.trim()) throw new Error("Title is required");
  const gid = Number(db.prepare("INSERT INTO goals (title, area, target_date, project_id, description) VALUES (?,?,?,?,?)").run(g.title.trim(), AREAS.includes(g.area ?? "") ? g.area : "General", g.target_date || null, g.project_id || null, g.description ?? "").lastInsertRowid);
  record("goal", gid, "created", { new: g.title });
  return gid;
}
export function setGoalStatus(id: number, status: Goal["status"]): boolean { const prev = db.prepare("SELECT status FROM goals WHERE id=?").get(id) as { status: string } | undefined; const ok = db.prepare("UPDATE goals SET status=? WHERE id=?").run(status, id).changes > 0; if (ok && prev?.status !== status) record("goal", id, "changed", { field: "Status", old: prev?.status, new: status }); return ok; }
export const deleteGoal = (id: number) => { record("goal", id, "deleted"); return db.prepare("DELETE FROM goals WHERE id=?").run(id).changes > 0; };
export const keyResults = (goalId: number) => db.prepare("SELECT * FROM key_results WHERE goal_id=? ORDER BY id").all(goalId) as KR[];
export function addKeyResult(goalId: number, title: string, target: number, unit = "") { if (!(target > 0)) throw new Error("Target must be above zero"); return Number(db.prepare("INSERT INTO key_results (goal_id, title, target, unit) VALUES (?,?,?,?)").run(goalId, title.trim(), target, unit.trim()).lastInsertRowid); }
export function setKeyResult(id: number, current: number): boolean { const prev = db.prepare("SELECT goal_id, title, current FROM key_results WHERE id=?").get(id) as { goal_id: number; title: string; current: number } | undefined; const ok = db.prepare("UPDATE key_results SET current=? WHERE id=?").run(current, id).changes > 0; if (ok && prev && prev.current !== current) record("goal", prev.goal_id, "changed", { field: prev.title, old: prev.current, new: current }); return ok; }
export const deleteKeyResult = (id: number) => db.prepare("DELETE FROM key_results WHERE id=?").run(id).changes > 0;
/** Progress blends two signals when both exist: finished tasks in the linked project, and the average of the key results. */
export function goalProgress(g: Goal) {
  let tasksDone = 0, tasksTotal = 0;
  if (g.project_id) { const r = db.prepare("SELECT count(*) total, count(done_at) done FROM tasks WHERE project_id=? AND parent_id IS NULL AND deleted_at IS NULL").get(g.project_id) as { total: number; done: number }; tasksDone = r.done; tasksTotal = r.total; }
  const krs = keyResults(g.id), krPct = krs.length ? krs.reduce((n, k) => n + Math.min(1, k.current / k.target), 0) / krs.length : null, taskPct = tasksTotal ? tasksDone / tasksTotal : null;
  const parts = [taskPct, krPct].filter((x): x is number => x !== null);
  const pct = g.status === "done" ? 100 : parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : 0;
  return { pct, tasksDone, tasksTotal, krs, krPct: krPct === null ? null : Math.round(krPct * 100) };
}
export function areaBalance() { const by = new Map<string, number[]>(); for (const g of listGoals()) (by.get(g.area) ?? by.set(g.area, []).get(g.area)!).push(goalProgress(g).pct); return AREAS.map((a) => ({ area: a, goals: by.get(a)?.length ?? 0, avg: by.get(a) ? Math.round(by.get(a)!.reduce((x, y) => x + y, 0) / by.get(a)!.length) : 0 })); }
