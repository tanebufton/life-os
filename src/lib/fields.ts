import { db } from "./db";

/** Custom fields on tasks: your own properties (a client, a cost, a link, a stage). A field belongs to every task, or to one project. */
export const FIELD_TYPES = ["text", "number", "select", "date", "checkbox", "url"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export type Field = { id: number; project_id: number | null; name: string; type: FieldType; options: string[]; show_on_card: boolean; position: number };
type Raw = Omit<Field, "options" | "show_on_card"> & { options: string; show_on_card: number };
const hydrate = (r: Raw): Field => ({ ...r, options: r.options ? r.options.split("\n").filter(Boolean) : [], show_on_card: !!r.show_on_card });
/** Fields that apply to a task in this project: the ones for everything, then the project's own. */
export const listFields = (projectId: number | null): Field[] => (db.prepare("SELECT * FROM custom_fields WHERE project_id IS NULL OR project_id IS ? ORDER BY project_id IS NOT NULL, position, id").all(projectId) as Raw[]).map(hydrate);
export const listAllFields = (): Field[] => (db.prepare("SELECT * FROM custom_fields ORDER BY project_id IS NOT NULL, project_id, position, id").all() as Raw[]).map(hydrate);

export type FieldInput = { id?: number; project_id: number | null; name: string; type: string; options?: string[]; show_on_card?: boolean };
export function saveField(i: FieldInput): number {
  const name = i.name.replace(/\s+/g, " ").trim(); if (!name) throw new Error("A field needs a name"); if (name.length > 40) throw new Error("Keep field names under 40 characters");
  if (!(FIELD_TYPES as readonly string[]).includes(i.type)) throw new Error("Unknown field type");
  const options = i.type === "select" ? [...new Set((i.options ?? []).map((o) => o.trim()).filter(Boolean))].slice(0, 30) : [];
  if (i.type === "select" && !options.length) throw new Error("Add at least one choice for a select field");
  if (i.project_id !== null && !db.prepare("SELECT 1 FROM projects WHERE id=?").get(i.project_id)) throw new Error("Project not found");
  const dup = db.prepare("SELECT id FROM custom_fields WHERE lower(name)=lower(?) AND project_id IS ? AND id IS NOT ?").get(name, i.project_id, i.id ?? null); if (dup) throw new Error("There is already a field with that name");
  if (i.id) { db.prepare("UPDATE custom_fields SET name=?, type=?, options=?, show_on_card=? WHERE id=?").run(name, i.type, options.join("\n"), i.show_on_card ? 1 : 0, i.id); return i.id; }
  const pos = ((db.prepare("SELECT max(position) m FROM custom_fields").get() as { m: number | null }).m ?? 0) + 1;
  return Number(db.prepare("INSERT INTO custom_fields (project_id, name, type, options, show_on_card, position) VALUES (?,?,?,?,?,?)").run(i.project_id, name, i.type, options.join("\n"), i.show_on_card ? 1 : 0, pos).lastInsertRowid);
}
export const deleteField = (id: number) => db.prepare("DELETE FROM custom_fields WHERE id=?").run(id).changes > 0;
export function moveField(id: number, dir: -1 | 1) {
  const all = listAllFields(), a = all.find((f) => f.id === id); if (!a) return; const peers = all.filter((f) => f.project_id === a.project_id), i = peers.findIndex((f) => f.id === id), b = peers[i + dir]; if (!b) return;
  db.transaction(() => { db.prepare("UPDATE custom_fields SET position=? WHERE id=?").run(b.position, a.id); db.prepare("UPDATE custom_fields SET position=? WHERE id=?").run(a.position, b.id); })();
}

/** Check a value for its type and give back the stored form ("" means empty). */
export function cleanValue(f: Field, raw: string): string {
  const v = String(raw ?? "").trim().slice(0, 2000); if (!v) return "";
  switch (f.type) {
    case "number": { const n = Number(v.replace(/,/g, "")); if (!Number.isFinite(n)) throw new Error(`${f.name} should be a number`); return String(n); }
    case "date": if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`${f.name} should be a date`); return v;
    case "checkbox": return v === "1" || v === "true" ? "1" : "";
    case "select": if (!f.options.includes(v)) throw new Error(`${v} isn't one of the choices for ${f.name}`); return v;
    case "url": { let u: URL; try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`); } catch { throw new Error(`${f.name} should be a web address`); } if (!/^https?:$/.test(u.protocol)) throw new Error(`${f.name} must be an http or https address`); return u.toString(); }
    default: return v;
  }
}
export function setFieldValue(taskId: number, fieldId: number, raw: string) {
  const f = (db.prepare("SELECT * FROM custom_fields WHERE id=?").get(fieldId) as Raw | undefined), t = db.prepare("SELECT project_id FROM tasks WHERE id=? AND deleted_at IS NULL").get(taskId) as { project_id: number | null } | undefined;
  if (!f || !t) throw new Error("Task or field not found"); if (f.project_id !== null && f.project_id !== t.project_id) throw new Error("That field belongs to a different project");
  const v = cleanValue(hydrate(f), raw);
  if (!v) db.prepare("DELETE FROM task_fields WHERE task_id=? AND field_id=?").run(taskId, fieldId); else db.prepare("INSERT INTO task_fields (task_id, field_id, value) VALUES (?,?,?) ON CONFLICT(task_id, field_id) DO UPDATE SET value=excluded.value").run(taskId, fieldId, v);
}
export const taskFieldValues = (taskId: number): Record<number, string> => Object.fromEntries((db.prepare("SELECT field_id, value FROM task_fields WHERE task_id=?").all(taskId) as { field_id: number; value: string }[]).map((r) => [r.field_id, r.value]));
/** Values for many tasks at once, for boards and tables: taskId -> fieldId -> value. */
export function fieldValuesFor(taskIds: number[]): Map<number, Record<number, string>> {
  const out = new Map<number, Record<number, string>>(); if (!taskIds.length) return out;
  for (let i = 0; i < taskIds.length; i += 500) { const ids = taskIds.slice(i, i + 500); for (const r of db.prepare(`SELECT task_id, field_id, value FROM task_fields WHERE task_id IN (${ids.map(() => "?").join(",")})`).all(...ids) as { task_id: number; field_id: number; value: string }[]) (out.get(r.task_id) ?? out.set(r.task_id, {}).get(r.task_id)!)[r.field_id] = r.value; }
  return out;
}
