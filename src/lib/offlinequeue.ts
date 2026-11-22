"use client";
import { useSyncExternalStore } from "react";
import { addCardAction, moveTask as moveTaskAction, setDoneAction } from "@/lib/actions5";
import { quickAdd } from "@/lib/actions";

/** Changes made while offline wait here (in this browser) and are sent, in order, when the connection is back. */
export type Op = { id: string; at: number } & (
  | { type: "add"; fields: Record<string, string> }                       // the quick-add bar
  | { type: "addcard"; text: string; column: string; project_id: number | null } // a board's Add card
  | { type: "done"; task: number; done: boolean }                         // tick / untick
  | { type: "move"; task: number; status: string });                      // drag to another column
type NewOp = Op extends infer O ? (O extends Op ? Omit<O, "id" | "at"> : never) : never;
const KEY = "lifeos.queue", EVT = "lifeos:queue";
let cache: Op[] | null = null;
const read = (): Op[] => { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { cache = []; } return cache!; };
const write = (q: Op[]) => { cache = q; try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* storage full or blocked: the queue still works until reload */ } window.dispatchEvent(new Event(EVT)); };
export const pendingOps = () => read();
export function enqueue(op: NewOp): Op { const full = { ...op, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now() } as Op; write([...read(), full]); return full; }
const subscribe = (fn: () => void) => { const f = () => { cache = null; fn(); }; window.addEventListener(EVT, fn); window.addEventListener("storage", f); return () => { window.removeEventListener(EVT, fn); window.removeEventListener("storage", f); }; };
const EMPTY: Op[] = [];
export const usePending = (): Op[] => useSyncExternalStore(subscribe, read, () => EMPTY);

export const isNetworkError = (e: unknown) => e instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(String((e as Error)?.message ?? e));
/** Run a change; if there's no connection, keep it for later instead. Returns whether it was queued. */
export async function runOrQueue<T>(op: NewOp, run: () => Promise<T>): Promise<{ queued: true } | { queued: false; result: T }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) { enqueue(op); return { queued: true }; }
  try { return { queued: false, result: await run() }; }
  catch (e) { if (isNetworkError(e)) { enqueue(op); return { queued: true }; } throw e; }
}

let replaying = false;
/** Send everything that's waiting. Stops at the first network failure (try again later); a change the server refuses is dropped and counted. */
export async function replay(): Promise<{ sent: number; dropped: number; left: number }> {
  if (replaying) return { sent: 0, dropped: 0, left: read().length }; replaying = true; let sent = 0, dropped = 0;
  try {
    for (const op of [...read()]) {
      try {
        let ok = true;
        if (op.type === "add") { const fd = new FormData(); for (const [k, v] of Object.entries(op.fields)) fd.set(k, v); await quickAdd(fd); }
        else if (op.type === "addcard") { const r = await addCardAction(op.text, op.column, op.project_id); ok = r.ok; }
        else if (op.type === "done") { const r = await setDoneAction(op.task, op.done); ok = r.ok; }
        else if (op.type === "move") { const r = await moveTaskAction(op.task, op.status); ok = r.ok; }
        write(read().filter((x) => x.id !== op.id)); if (ok) sent++; else dropped++;
      } catch (e) { if (isNetworkError(e)) break; write(read().filter((x) => x.id !== op.id)); dropped++; }
    }
  } finally { replaying = false; }
  return { sent, dropped, left: read().length };
}
