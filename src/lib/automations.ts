import { db } from "./db";
import { addDays } from "./dates";
import { today } from "./time";
import { kindOf, listStatuses, statusByKey } from "./statuses";
import { setStatus, updateTask } from "./tasks";

/** A board automation: "N days before the due date (0 = on it), move the card to this column, at the top, and optionally set its priority." Each card is handled once per due date, so moving it back by hand sticks. */
export type Rule = { id: number; project_id: number | null; kind: string; offset_days: number; column_key: string; to_top: number; set_priority: number | null; enabled: number };
export const listRules = (projectId: number | null): Rule[] => db.prepare(`SELECT * FROM board_rules WHERE ${projectId === null ? "project_id IS NULL" : "project_id=?"} ORDER BY id`).all(...(projectId === null ? [] : [projectId])) as Rule[];

export type RuleInput = { id?: number; project_id: number | null; offset_days: number; column_key: string; to_top: boolean; set_priority: number | null; enabled?: boolean };
export function saveRule(i: RuleInput): number {
  const offset = Math.max(0, Math.min(30, Math.floor(i.offset_days) || 0)), col = statusByKey(i.column_key);
  if (!col || col.kind === "done") throw new Error("Pick a column that isn't a Done column");
  if (!listStatuses(i.project_id).some((s) => s.key === i.column_key)) throw new Error("That column isn't on this board");
  if (i.set_priority !== null && ![-1, 0, 1].includes(i.set_priority)) throw new Error("Priority must be low, normal or high");
  if (i.project_id !== null && !db.prepare("SELECT 1 FROM projects WHERE id=?").get(i.project_id)) throw new Error("Project not found");
  if (i.id) { db.prepare("UPDATE board_rules SET offset_days=?, column_key=?, to_top=?, set_priority=?, enabled=? WHERE id=?").run(offset, i.column_key, i.to_top ? 1 : 0, i.set_priority, i.enabled === false ? 0 : 1, i.id); return i.id; }
  const id = Number(db.prepare("INSERT INTO board_rules (project_id, offset_days, column_key, to_top, set_priority, enabled) VALUES (?,?,?,?,?,1)").run(i.project_id, offset, i.column_key, i.to_top ? 1 : 0, i.set_priority).lastInsertRowid);
  // Cards that are already overdue when the rule is made are left where they are: the rule is about dates that arrive from now on.
  db.prepare(`INSERT OR IGNORE INTO rule_runs (rule_id, task_id, due) SELECT ?, t.id, t.due FROM tasks t WHERE t.done_at IS NULL AND t.deleted_at IS NULL AND t.parent_id IS NULL AND t.due IS NOT NULL AND t.due < ? AND ${scopeSql(i.project_id)}`).run(id, today(), ...(i.project_id === null ? [] : [i.project_id]));
  return id;
}
const scopeSql = (projectId: number | null) => (projectId === null ? "(t.project_id IS NULL OR t.project_id NOT IN (SELECT project_id FROM statuses WHERE project_id IS NOT NULL))" : "t.project_id = ?");
export const deleteRule = (id: number) => db.prepare("DELETE FROM board_rules WHERE id=?").run(id).changes > 0;

let last = 0;
/** Apply every enabled rule. Safe to call often and from several processes: a card is claimed in rule_runs before it is touched. Returns how many cards moved. */
export function runBoardAutomations(opts: { now?: string; force?: boolean } = {}): number {
  if (!opts.force && Date.now() - last < 15_000) return 0; last = Date.now();
  const now = opts.now ?? today(); let moved = 0;
  const rules = db.prepare("SELECT * FROM board_rules WHERE enabled=1").all() as Rule[]; if (!rules.length) return 0;
  const claim = db.prepare("INSERT OR IGNORE INTO rule_runs (rule_id, task_id, due) VALUES (?,?,?)");
  for (const r of rules) {
    const col = statusByKey(r.column_key); if (!col || col.kind === "done") continue;
    const scope = scopeSql(r.project_id);
    const tasks = db.prepare(`SELECT t.id, t.due, t.status, t.project_id FROM tasks t WHERE t.done_at IS NULL AND t.deleted_at IS NULL AND t.parent_id IS NULL AND t.due IS NOT NULL AND t.due <= ? AND ${scope} AND NOT EXISTS (SELECT 1 FROM rule_runs x WHERE x.rule_id = ? AND x.task_id = t.id AND x.due = t.due)`)
      .all(addDays(now, r.offset_days), ...(r.project_id === null ? [] : [r.project_id]), r.id) as { id: number; due: string; status: string; project_id: number | null }[];
    for (const t of tasks) {
      if (!listStatuses(t.project_id).some((s) => s.key === r.column_key)) continue; // this card's board doesn't have that column
      if (claim.run(r.id, t.id, t.due).changes === 0) continue; // another process got there first
      if (kindOf(t.status) === "done") continue;
      try {
        if (t.status !== r.column_key) { setStatus(t.id, r.column_key); moved++; }
        if (r.to_top) { const m = db.prepare("SELECT min(position) AS m FROM tasks WHERE status=? AND position IS NOT NULL AND deleted_at IS NULL AND done_at IS NULL").get(r.column_key) as { m: number | null }; db.prepare("UPDATE tasks SET position=? WHERE id=?").run((m.m ?? 1024) - 1024, t.id); }
        if (r.set_priority !== null) updateTask(t.id, { priority: r.set_priority });
      } catch { /* a card that can't be moved is left alone */ }
    }
  }
  return moved;
}
