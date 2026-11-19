// An append-only record of what changed, to what, and by whom. Written by the library functions, so the UI, API, MCP, Telegram and
// voice all leave the same trail. Old/new values are short summaries (never whole documents), and the log is pruned after a year.
import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "./db";

const als = new AsyncLocalStorage<{ actor: string }>();
let processActor = process.env.LIFEOS_ACTOR || "you";
/** For long-running helper processes (the MCP server, the worker): everything they do is attributed to them. */
export const setProcessActor = (a: string) => { processActor = a; };
/** Run `fn` so every change it makes is attributed to `actor` (e.g. "telegram", "voice"). */
export const runAs = <T>(actor: string, fn: () => T): T => als.run({ actor }, fn);
/** Attribute the rest of the current request to `actor` (used by the API once a token has been checked). */
export const setActor = (actor: string) => { als.enterWith({ actor }); };
export const currentActor = () => als.getStore()?.actor ?? processActor;

export type Entity = "task" | "note" | "goal";
export type Event = { id: number; entity: Entity; entity_id: number; action: string; field: string | null; old: string | null; new: string | null; actor: string; at: string };
const cut = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v).replace(/\s+/g, " ").trim().slice(0, 160) || null);
export function record(entity: Entity, id: number, action: string, o: { field?: string; old?: unknown; new?: unknown } = {}) {
  try { db.prepare("INSERT INTO activity (entity, entity_id, action, field, old, new, actor) VALUES (?,?,?,?,?,?,?)").run(entity, id, action, o.field ?? null, cut(o.old), cut(o.new), currentActor().slice(0, 40)); } catch { /* the trail must never break the change itself */ }
}
/** Record one event per field that actually changed. */
export function recordDiff(entity: Entity, id: number, before: Record<string, unknown>, after: Record<string, unknown>, fields: Record<string, string>) {
  for (const [k, label] of Object.entries(fields)) if ((before[k] ?? null) !== (after[k] ?? null) && String(before[k] ?? "") !== String(after[k] ?? "")) record(entity, id, "changed", { field: label, old: before[k], new: after[k] });
}
export const history = (entity: Entity, id: number, limit = 60) => db.prepare("SELECT * FROM activity WHERE entity=? AND entity_id=? ORDER BY id DESC LIMIT ?").all(entity, id, limit) as Event[];
export const recentActivity = (limit = 100, entity?: Entity) => (entity ? db.prepare("SELECT * FROM activity WHERE entity=? ORDER BY id DESC LIMIT ?").all(entity, limit) : db.prepare("SELECT * FROM activity ORDER BY id DESC LIMIT ?").all(limit)) as Event[];
export const pruneActivity = (days = 365) => db.prepare("DELETE FROM activity WHERE at < datetime('now', ?)").run(`-${Math.max(30, days)} days`).changes;
/** A sentence for the history list. */
export function describeEvent(e: Event): string {
  switch (e.action) {
    case "created": return "Created";
    case "completed": return "Completed";
    case "reopened": return "Reopened";
    case "deleted": return "Deleted";
    case "restored": return "Restored";
    case "edited": return e.field ? `Edited ${e.field}${e.old && e.new ? ` (${e.old} → ${e.new})` : ""}` : "Edited";
    case "linked": return `Linked to ${(e.field ?? "item").toLowerCase()}${e.new ? `: ${e.new}` : ""}`;
    case "unlinked": return `Unlinked ${(e.field ?? "item").toLowerCase()}${e.old ? `: ${e.old}` : ""}`;
    case "changed": return e.old || e.new ? `${e.field}: ${e.old ?? "none"} → ${e.new ?? "none"}` : `${e.field} changed`;
    default: return `${e.action}${e.field ? ` ${e.field}` : ""}`;
  }
}
