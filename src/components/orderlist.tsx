"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "./Icon";

export type OrderItem = { id: string; label: string; icon?: string; on: boolean };
/**
 * Pick which items are shown and in what order. `max` caps how many can be on (the phone bar fits 4).
 * Saves on every change (debounced) so there's no Save button to forget.
 */
export function OrderList({ items, max, save, onReset, preview, hint }: { items: OrderItem[]; max?: number; save: (order: string[], on: string[]) => Promise<void>; onReset: () => Promise<void>; preview?: boolean; hint?: string }) {
  const [list, setList] = useState(items), [, start] = useTransition(), t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const commit = (next: OrderItem[]) => { setList(next); clearTimeout(t.current); t.current = setTimeout(() => start(async () => { await save(next.map((x) => x.id), next.filter((x) => x.on).map((x) => x.id)); toast("Saved"); }), 500); };
  const count = list.filter((x) => x.on).length;
  const toggle = (id: string) => { const cur = list.find((x) => x.id === id)!; if (!cur.on && max && count >= max) { toast(`The bar fits ${max}. Turn one off first.`); return; } commit(list.map((x) => (x.id === id ? { ...x, on: !x.on } : x))); };
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= list.length) return; const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; commit(n); };
  const shown = list.filter((x) => x.on);
  return (
    <div>
      {preview && (
        <div className="mx-auto mb-4 max-w-sm rounded-2xl border bg-bg p-1 shadow-sm" aria-label="Preview of your phone bar"><div className="flex">{[...shown.map((x) => ({ ...x, icon: x.icon ?? "list" })), { id: "more", label: "More", icon: "more", on: true }].map((x, i, a) => (
          <div key={x.id} className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${i === 0 ? "text-accent" : "text-mute"}`}><Icon name={x.icon!} size={20} /><span className="max-w-full truncate px-0.5">{x.label === "My tasks" ? "Tasks" : x.label}</span>{i === a.length - 1 && false}</div>))}</div></div>
      )}
      {hint && <p className="mb-2 px-1 text-xs text-mute">{max ? `${count} of ${max} chosen. ` : ""}{hint}</p>}
      <ul className="divide-y rounded-lg border">{list.map((x, i) => (
        <li key={x.id} className={`flex items-center gap-3 px-3 py-2 ${x.on ? "" : "opacity-60"}`}>
          <input type="checkbox" checked={x.on} onChange={() => toggle(x.id)} aria-label={`Show ${x.label}`} className="h-4 w-4" />
          {x.icon && <Icon name={x.icon} size={17} className="text-mute" />}<span className="flex-1 text-[14px]">{x.label}</span>
          {x.on && max && <span className="text-xs tabular-nums text-dim">{shown.findIndex((s) => s.id === x.id) + 1}</span>}
          <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${x.label} up`} className="rounded p-1 text-mute hover:bg-raise disabled:opacity-25"><Icon name="chevUp2" size={15} className="rotate-0" /></button>
          <button onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${x.label} down`} className="rounded p-1 text-mute hover:bg-raise disabled:opacity-25"><Icon name="chevDown" size={15} /></button>
        </li>))}</ul>
      <div className="mt-2 text-right"><button className="text-xs text-mute hover:text-fg" onClick={() => start(async () => { await onReset(); toast("Back to defaults"); setTimeout(() => location.reload(), 300); })}>Reset to default</button></div>
    </div>
  );
}
