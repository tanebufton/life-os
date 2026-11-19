import { db } from "./db";
import { addDays } from "./dates";
import { createTask, getTask, subtasks } from "./tasks";
import { today } from "./time";

export type TemplateData = { title: string; notes?: string; tags?: string[]; estimate?: number | null; project?: string; repeat?: string | null; priority?: number; subtasks: string[]; dueInDays?: number | null };
export type Template = { id: number; name: string; description: string; data: TemplateData };
const hydrate = (r: { id: number; name: string; description: string; data: string }): Template => ({ ...r, data: JSON.parse(r.data) });
export const listTemplates = (): Template[] => (db.prepare("SELECT * FROM templates ORDER BY name COLLATE NOCASE").all() as never[]).map(hydrate);
export const getTemplate = (id: number) => { const r = db.prepare("SELECT * FROM templates WHERE id=?").get(id); return r ? hydrate(r as never) : undefined; };
export function createTemplate(name: string, data: TemplateData, description = ""): number {
  if (!name.trim() || !data.title?.trim()) throw new Error("A template needs a name and a task title");
  return Number(db.prepare("INSERT INTO templates (name, description, data) VALUES (?,?,?)").run(name.trim(), description, JSON.stringify({ ...data, subtasks: (data.subtasks ?? []).map((s) => s.trim()).filter(Boolean) })).lastInsertRowid);
}
export const deleteTemplate = (id: number) => db.prepare("DELETE FROM templates WHERE id=?").run(id).changes > 0;
export function templateFromTask(taskId: number, name?: string): number | null {
  const t = getTask(taskId); if (!t) return null;
  return createTemplate(name || t.title, { title: t.title, notes: t.notes, tags: t.tags, estimate: t.estimate, project: t.project_name ?? undefined, repeat: t.repeat, priority: t.priority, subtasks: subtasks(taskId).map((s) => s.title) });
}
/** Create the task (and its subtasks) from a template. `due` overrides the template's relative due date. */
export function useTemplate(id: number, o: { due?: string | null; title?: string } = {}): number | null {
  const tpl = getTemplate(id); if (!tpl) return null; const d = tpl.data;
  const due = o.due !== undefined ? o.due : d.dueInDays != null ? addDays(today(), d.dueInDays) : undefined;
  const tid = createTask({ title: o.title || d.title, notes: d.notes, tags: d.tags, estimate: d.estimate ?? undefined, project: d.project, repeat: d.repeat ?? undefined, priority: d.priority, due: due as string | null | undefined });
  for (const s of d.subtasks) createTask({ title: s, parent_id: tid });
  return tid;
}
export const STARTER_TEMPLATES: { name: string; description: string; data: TemplateData }[] = [
  { name: "Weekly review", description: "Clear the decks every Friday", data: { title: "Weekly review", repeat: "weekly", estimate: 30, tags: ["routine"], subtasks: ["Empty the inbox", "Review overdue tasks", "Check next week's calendar", "Review goals and habits", "Plan three priorities for Monday"] } },
  { name: "Trip packing list", description: "Never forget the charger again", data: { title: "Pack for trip", estimate: 45, tags: ["travel"], subtasks: ["Passport / ID and tickets", "Phone, chargers and adapters", "Medication", "Clothes for the weather", "Toiletries", "Book transport to the airport", "Check in online"] } },
  { name: "Monthly bills run", description: "Go through everything that comes out", data: { title: "Monthly bills run-through", repeat: "monthly", estimate: 30, tags: ["bills"], subtasks: ["Check the budget vs. last month", "Review subscriptions", "Pay credit card", "Move money to savings"] } },
  { name: "Move house", description: "The long checklist", data: { title: "Move house", tags: ["home"], subtasks: ["Book removalists", "Change address (bank, insurance, work)", "Redirect mail", "Set up internet at the new place", "Pack room by room", "Clean the old place", "Take meter readings"] } },
];
export function installStarterTemplates(): number { const have = new Set(listTemplates().map((t) => t.name)); let n = 0; for (const s of STARTER_TEMPLATES) if (!have.has(s.name)) { createTemplate(s.name, s.data, s.description); n++; } return n; }
