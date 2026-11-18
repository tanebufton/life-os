"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteTaskInline, rescheduleAction, restoreTaskAction } from "@/lib/actions";
import { Icon } from "./Icon";

const rowsOf = () => [...document.querySelectorAll<HTMLElement>("[data-task-id]")];
/** Todoist/Linear-style keyboard control of whichever task list is on screen. */
export function ListKeys() {
  const router = useRouter(), path = usePathname();
  const active = useRef<number | null>(null);
  const paint = () => rowsOf().forEach((r) => (Number(r.dataset.taskId) === active.current ? r.setAttribute("data-active", "true") : r.removeAttribute("data-active")));
  useEffect(() => { active.current = null; paint(); }, [path]);
  useEffect(() => {
    const mo = new MutationObserver(() => paint());
    mo.observe(document.body, { childList: true, subtree: true });
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName) && e.key !== "Escape" && el.tagName !== "A" && el.tagName !== "BUTTON" || el.isContentEditable) return;
      const rows = rowsOf(); if (!rows.length) return;
      const idx = rows.findIndex((r) => Number(r.dataset.taskId) === active.current);
      const cur = idx >= 0 ? rows[idx] : null, id = active.current;
      const move = (d: number) => { const n = rows[Math.max(0, Math.min(rows.length - 1, (idx < 0 ? (d > 0 ? -1 : rows.length) : idx) + d))]; active.current = Number(n.dataset.taskId); paint(); n.scrollIntoView({ block: "nearest" }); };
      if (e.key === "j" || e.key === "ArrowDown") { if (e.key === "ArrowDown" && el.tagName !== "BODY") return; e.preventDefault(); move(1); }
      else if (e.key === "k" || e.key === "ArrowUp") { if (e.key === "ArrowUp" && el.tagName !== "BODY") return; e.preventDefault(); move(-1); }
      else if (cur && id) {
        if (e.key === "x") { e.preventDefault(); cur.querySelector<HTMLButtonElement>("[data-check]")?.click(); }
        else if (e.key === "e" || e.key === "o" || (e.key === "Enter" && el.tagName === "BODY")) { e.preventDefault(); router.push(`/tasks/${id}`); }
        else if (e.key === "t") { e.preventDefault(); void rescheduleAction(id, "tomorrow").then(() => toast("Moved to tomorrow")); }
        else if (e.key === "w") { e.preventDefault(); void rescheduleAction(id, "nextweek").then(() => toast("Moved to next week")); }
        else if (e.key === "#" || e.key === "Delete") { e.preventDefault(); void deleteTaskInline(id).then((r) => r && toast(`Deleted “${r.title}”`, { action: { label: "Undo", onClick: () => void restoreTaskAction(id) } })); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); mo.disconnect(); };
  }, [router]);
  return null;
}

const GROUPS: [string, [string[], string][]][] = [
  ["Anywhere", [[["C", "/"], "Capture a new task"], [["⌘", "K"], "Search and jump anywhere"], [["G", "T"], "Go to Today (G then I, U, L, B, H, J, F, R, X, N, S for others)"], [["?"], "Show this help"]]],
  ["In a task list", [[["J", "K"], "Move down / up"], [["X"], "Complete the selected task"], [["E", "Enter"], "Open the selected task"], [["T"], "Move to tomorrow"], [["W"], "Move to next week"], [["#", "Del"], "Delete (with undo)"]]],
  ["Quick add syntax", [[["#tag"], "Label"], [["@project"], "Project"], [["!high", "!low"], "Priority"], [["tomorrow", "fri", "in 3 days"], "Due date"], [["at 5pm"], "Time"], [["~30m"], "Estimate"], [["daily", "every 2 weeks"], "Repeat"]]],
];
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => { const o = () => setOpen(true), k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); window.addEventListener("lifeos:help", o); window.addEventListener("keydown", k); return () => { window.removeEventListener("lifeos:help", o); window.removeEventListener("keydown", k); }; }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-panel p-5 shadow-[0_20px_60px_rgb(0_0_0/0.25)]">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Keyboard shortcuts</h2><button onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-mute hover:bg-raise"><Icon name="x" size={16} /></button></div>
        {GROUPS.map(([g, rows]) => (
          <section key={g} className="mb-4 last:mb-0"><h3 className="mb-1.5 text-xs font-semibold text-mute">{g}</h3>
            <ul className="divide-y">{rows.map(([keys, what]) => (
              <li key={what} className="flex items-center justify-between gap-4 py-1.5 text-[13px]"><span>{what}</span>
                <span className="flex shrink-0 gap-1">{keys.map((k) => <kbd key={k} className="rounded border bg-raise px-1.5 py-0.5 text-[11px] font-medium text-mute">{k}</kbd>)}</span></li>))}</ul></section>
        ))}
      </div>
    </div>
  );
}
