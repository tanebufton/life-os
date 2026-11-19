import { db } from "./db";
import { addDays, diffDays } from "./dates";
import { createTask } from "./tasks";
import { today } from "./time";

export type Person = { id: number; name: string; notes: string; birthday: string | null; cadence_days: number | null; last_contact: string | null; archived: number; created_at: string };
export const listPeople = () => db.prepare("SELECT * FROM people WHERE archived=0 ORDER BY name COLLATE NOCASE").all() as Person[];
export const getPerson = (id: number) => db.prepare("SELECT * FROM people WHERE id=?").get(id) as Person | undefined;
const validBday = (b?: string | null) => (b && /^(\d{4}-)?\d{2}-\d{2}$/.test(b.trim()) ? b.trim() : null);
export function createPerson(p: { name: string; birthday?: string | null; cadence_days?: number | null; notes?: string; last_contact?: string | null }): number {
  if (!p.name.trim()) throw new Error("Name is required");
  return Number(db.prepare("INSERT INTO people (name, birthday, cadence_days, notes, last_contact) VALUES (?,?,?,?,?)").run(p.name.trim(), validBday(p.birthday), p.cadence_days && p.cadence_days > 0 ? Math.round(p.cadence_days) : null, p.notes ?? "", p.last_contact || null).lastInsertRowid);
}
export function updatePerson(id: number, p: Partial<Pick<Person, "name" | "notes" | "birthday" | "cadence_days">>) {
  const sets: string[] = [], a: unknown[] = []; for (const [k, v] of Object.entries(p)) { if (v === undefined) continue; sets.push(`${k}=?`); a.push(k === "birthday" ? validBday(v as string) : v); }
  return sets.length ? db.prepare(`UPDATE people SET ${sets.join(",")} WHERE id=?`).run(...a, id).changes > 0 : false;
}
export const archivePerson = (id: number) => db.prepare("UPDATE people SET archived=1 WHERE id=?").run(id).changes > 0;
export function logContact(id: number, note = "", date = today()) { db.prepare("INSERT INTO interactions (person_id, date, note) VALUES (?,?,?)").run(id, date, note); return db.prepare("UPDATE people SET last_contact=MAX(COALESCE(last_contact,''), ?) WHERE id=?").run(date, id).changes > 0; }
export const interactions = (id: number, limit = 8) => db.prepare("SELECT date, note FROM interactions WHERE person_id=? ORDER BY date DESC, id DESC LIMIT ?").all(id, limit) as { date: string; note: string }[];
/** Days until the catch-up is due (negative = overdue). Null when there's no cadence. */
export function catchUpIn(p: Person, t = today()): number | null { if (!p.cadence_days) return null; const base = p.last_contact ?? p.created_at.slice(0, 10); return diffDays(addDays(base, p.cadence_days), t); }
export function nextBirthday(p: Person, t = today()): { date: string; in: number; age: number | null } | null {
  if (!p.birthday) return null; const [y, md] = p.birthday.length === 10 ? [Number(p.birthday.slice(0, 4)), p.birthday.slice(5)] : [null, p.birthday];
  const yr = Number(t.slice(0, 4)); let d = `${yr}-${md}`; if (md === "02-29" && !new Date(Date.UTC(yr, 1, 29)).getUTCMonth()) d = `${yr}-02-28`; if (d < t) { const ny = yr + 1; d = `${ny}-${md}`; }
  return { date: d, in: diffDays(d, t), age: y ? Number(d.slice(0, 4)) - y : null };
}
export const upcomingBirthdays = (days = 14, t = today()) => listPeople().map((p) => ({ p, b: nextBirthday(p, t) })).filter((x) => x.b && x.b.in <= days).sort((a, b) => a.b!.in - b.b!.in) as { p: Person; b: NonNullable<ReturnType<typeof nextBirthday>> }[];
export const overdueCatchUps = (t = today()) => listPeople().map((p) => ({ p, n: catchUpIn(p, t) })).filter((x) => x.n !== null && x.n <= 0).sort((a, b) => a.n! - b.n!) as { p: Person; n: number }[];
export function followUpTask(id: number): number | null { const p = getPerson(id); if (!p) return null; return createTask({ title: `Catch up with ${p.name}`, tags: ["people"], due: today(), estimate: 20, source: "manual" }); }
export function peopleReminders(t = today()): { key: string; title: string; body: string }[] {
  const out: { key: string; title: string; body: string }[] = [];
  for (const { p, b } of upcomingBirthdays(1, t)) if (b.in <= 1) out.push({ key: `bday:${p.id}:${b.date}:${b.in}`, title: b.in === 0 ? `${p.name}'s birthday today${b.age ? ` (${b.age})` : ""}` : `${p.name}'s birthday tomorrow`, body: "Send a message?" });
  const week = `${t.slice(0, 4)}-W${Math.floor(diffDays(t, t.slice(0, 4) + "-01-01") / 7)}`;
  const due = overdueCatchUps(t).slice(0, 3); if (due.length) out.push({ key: `catchup:${week}`, title: `Time to catch up with ${due.map((d) => d.p.name).join(", ")}`, body: due.map((d) => `${d.p.name}: ${d.n === 0 ? "due today" : `${-d.n} days overdue`}`).join("\n") });
  return out;
}
