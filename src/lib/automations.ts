import { db } from "./db";
import { addDays } from "./dates";
import { today } from "./time";
import { kindOf, listStatuses, statusByKey } from "./statuses";
import { getTask, setStatus, updateTask } from "./tasks";

/**
 * Board automations: "when ___, then ___". Each card is handled once per occasion (per due date, per time it entered a column), so moving it back by hand sticks.
 *  When:  due     the due date arrives (0 = on the day, N = N days before)
 *         enter   a card is moved into a column
 *         stale   a card has sat in a column for N days
 *         created a card is created
 *  Then:  move to a column (optionally to the top), set the priority, add a tag, set the due date. Any combination.
 */
export type Rule = { id: number; project_id: number | null; kind: string; offset_days: number; column_key: string; when_column: string; to_top: number; set_priority: number | null; add_tag: string; set_due: string; enabled: number; created_at: string };
export const KINDS = ["due", "enter", "stale", "created"] as const, SET_DUE = ["", "today", "tomorrow", "week", "clear"] as const;
export const listRules = (projectId: number | null): Rule[] => db.prepare(`SELECT * FROM board_rules WHERE ${projectId === null ? "project_id IS NULL" : "project_id=?"} ORDER BY id`).all(...(projectId === null ? [] : [projectId])) as Rule[];

export type RuleInput = { id?: number; project_id: number | null; kind?: string; offset_days: number; column_key: string; when_column?: string; to_top: boolean; set_priority: number | null; add_tag?: string; set_due?: string; enabled?: boolean };
const scopeSql = (projectId: number | null) => (projectId === null ? "(t.project_id IS NULL OR t.project_id NOT IN (SELECT project_id FROM statuses WHERE project_id IS NOT NULL))" : "t.project_id = ?");
export function saveRule(i: RuleInput): number {
  const kind = i.kind ?? "due", moveTo = i.column_key ?? "", when = i.when_column ?? "", tag = (i.add_tag ?? "").trim().replace(/^#/, "").slice(0, 40), setDue = i.set_due ?? "";
  if (!(KINDS as readonly string[]).includes(kind)) throw new Error("Unknown trigger");
  if (!(SET_DUE as readonly string[]).includes(setDue)) throw new Error("Unknown due date option");
  const offset = Math.max(kind === "stale" ? 1 : 0, Math.min(90, Math.floor(i.offset_days) || 0));
  const set = listStatuses(i.project_id);
  if (moveTo) { const c = statusByKey(moveTo); if (!c || c.kind === "done") throw new Error("Pick a column that isn't a Done column"); if (!set.some((s) => s.key === moveTo)) throw new Error("That column isn't on this board"); }
  if ((kind === "enter" || kind === "stale") && !set.some((s) => s.key === when)) throw new Error("Pick the column to watch");
  if (kind === "created" && when && !set.some((s) => s.key === when)) throw new Error("That column isn't on this board");
  if (i.set_priority !== null && ![-1, 0, 1].includes(i.set_priority)) throw new Error("Priority must be low, normal or high");
  if (!moveTo && i.set_priority === null && !tag && !setDue) throw new Error("Choose what the automation should do");
  if (i.project_id !== null && !db.prepare("SELECT 1 FROM projects WHERE id=?").get(i.project_id)) throw new Error("Project not found");
  if (i.id) { db.prepare("UPDATE board_rules SET kind=?, offset_days=?, column_key=?, when_column=?, to_top=?, set_priority=?, add_tag=?, set_due=?, enabled=? WHERE id=?").run(kind, offset, moveTo, when, i.to_top ? 1 : 0, i.set_priority, tag, setDue, i.enabled === false ? 0 : 1, i.id); return i.id; }
  const id = Number(db.prepare("INSERT INTO board_rules (project_id, kind, offset_days, column_key, when_column, to_top, set_priority, add_tag, set_due, enabled) VALUES (?,?,?,?,?,?,?,?,?,1)").run(i.project_id, kind, offset, moveTo, when, i.to_top ? 1 : 0, i.set_priority, tag, setDue).lastInsertRowid);
  // Cards that are already overdue when a date rule is made are left where they are: the rule is about dates that arrive from now on.
  if (kind === "due") db.prepare(`INSERT OR IGNORE INTO rule_runs (rule_id, task_id, due) SELECT ?, t.id, t.due FROM tasks t WHERE t.done_at IS NULL AND t.deleted_at IS NULL AND t.parent_id IS NULL AND t.due IS NOT NULL AND t.due < ? AND ${scopeSql(i.project_id)}`).run(id, today(), ...(i.project_id === null ? [] : [i.project_id]));
  return id;
}
export const deleteRule = (id: number) => db.prepare("DELETE FROM board_rules WHERE id=?").run(id).changes > 0;

type Hit = { id: number; key: string; status: string; project_id: number | null };
function candidates(r: Rule, now: string): Hit[] {
  const base = "t.done_at IS NULL AND t.deleted_at IS NULL AND t.parent_id IS NULL", scope = scopeSql(r.project_id), sp = r.project_id === null ? [] : [r.project_id];
  const fresh = "NOT EXISTS (SELECT 1 FROM rule_runs x WHERE x.rule_id = ? AND x.task_id = t.id AND x.due = %KEY%)";
  const calm = "(SELECT count(*) FROM rule_runs y WHERE y.task_id = t.id AND y.at > datetime('now','-10 minutes')) < 6"; // a pair of rules that keep moving a card back and forth stops after a few goes
  if (r.kind === "due") return db.prepare(`SELECT t.id, t.due AS key, t.status, t.project_id FROM tasks t WHERE ${base} AND t.due IS NOT NULL AND t.due <= ? AND ${scope} AND ${fresh.replace("%KEY%", "t.due")} AND ${calm}`).all(addDays(now, r.offset_days), ...sp, r.id) as Hit[];
  if (r.kind === "enter") return db.prepare(`SELECT t.id, t.status_at AS key, t.status, t.project_id FROM tasks t WHERE ${base} AND t.status = ? AND t.status_at IS NOT NULL AND t.status_at > ? AND ${scope} AND ${fresh.replace("%KEY%", "t.status_at")} AND ${calm}`).all(r.when_column, r.created_at, ...sp, r.id) as Hit[];
  if (r.kind === "stale") return db.prepare(`SELECT t.id, COALESCE(t.status_at, t.created_at) AS key, t.status, t.project_id FROM tasks t WHERE ${base} AND t.status = ? AND COALESCE(t.status_at, t.created_at) <= datetime('now', ?) AND ${scope} AND ${fresh.replace("%KEY%", "COALESCE(t.status_at, t.created_at)")} AND ${calm}`).all(r.when_column, `-${r.offset_days} days`, ...sp, r.id) as Hit[];
  return db.prepare(`SELECT t.id, t.created_at AS key, t.status, t.project_id FROM tasks t WHERE ${base} AND t.created_at > ? AND (? = '' OR t.status = ?) AND ${scope} AND ${fresh.replace("%KEY%", "t.created_at")} AND ${calm}`).all(r.created_at, r.when_column, r.when_column, ...sp, r.id) as Hit[];
}
function act(r: Rule, t: Hit, now: string): boolean {
  let moved = false;
  if (r.column_key && t.status !== r.column_key && listStatuses(t.project_id).some((s) => s.key === r.column_key)) { setStatus(t.id, r.column_key); moved = true; }
  if (r.column_key && r.to_top) { const m = db.prepare("SELECT min(position) AS m FROM tasks WHERE status=? AND position IS NOT NULL AND deleted_at IS NULL AND done_at IS NULL").get(r.column_key) as { m: number | null }; db.prepare("UPDATE tasks SET position=? WHERE id=?").run((m.m ?? 1024) - 1024, t.id); }
  if (r.set_priority !== null) updateTask(t.id, { priority: r.set_priority });
  if (r.add_tag) { const cur = getTask(t.id)?.tags ?? []; if (!cur.some((g) => g.toLowerCase() === r.add_tag.toLowerCase())) updateTask(t.id, { tags: [...cur, r.add_tag] }); }
  if (r.set_due) updateTask(t.id, { due: r.set_due === "clear" ? null : r.set_due === "today" ? now : r.set_due === "tomorrow" ? addDays(now, 1) : addDays(now, 7) });
  return moved;
}

let last = 0;
/** Apply every enabled rule. Safe to call often and from several processes: a card is claimed in rule_runs before it is touched. Returns how many cards moved. */
export function runBoardAutomations(opts: { now?: string; force?: boolean } = {}): number {
  if (!opts.force && Date.now() - last < 15_000) return 0; last = Date.now();
  const now = opts.now ?? today(); let moved = 0;
  const rules = db.prepare("SELECT * FROM board_rules WHERE enabled=1 ORDER BY id").all() as Rule[]; if (!rules.length) return 0;
  const claim = db.prepare("INSERT OR IGNORE INTO rule_runs (rule_id, task_id, due) VALUES (?,?,?)");
  const done = new Set<number>(); // a card is touched by at most one rule per pass; the next pass picks up anything chained from it
  for (const r of rules) {
    if (r.column_key) { const col = statusByKey(r.column_key); if (!col || col.kind === "done") continue; }
    for (const t of candidates(r, now)) {
      if (done.has(t.id) || kindOf(t.status) === "done") continue;
      if (r.column_key && !listStatuses(t.project_id).some((s) => s.key === r.column_key)) continue; // this card's board doesn't have that column
      if (claim.run(r.id, t.id, t.key).changes === 0) continue; // another process got there first
      try { if (act(r, t, now)) moved++; done.add(t.id); } catch { /* a card that can't be changed is left alone */ }
    }
  }
  return moved;
}
