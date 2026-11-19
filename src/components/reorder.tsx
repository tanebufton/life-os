"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { setOrderAction } from "@/lib/actions5";

/** A task list whose rows can be dragged into a new order (rows are <li data-task-id>). The order is saved when you drop. */
export function ReorderList({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null), router = useRouter();
  useEffect(() => {
    const ul = ref.current; if (!ul) return; let drag: HTMLElement | null = null, moved = false;
    const rows = () => [...ul.children].filter((e): e is HTMLElement => e instanceof HTMLElement && !!e.dataset.taskId);
    const arm = () => rows().forEach((r) => { r.draggable = true; });
    arm(); const mo = new MutationObserver(arm); mo.observe(ul, { childList: true });
    const row = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.("li[data-task-id]") as HTMLElement | null;
    const start = (e: DragEvent) => { const r = row(e.target); if (!r || r.parentElement !== ul) return; drag = r; moved = false; e.dataTransfer!.effectAllowed = "move"; e.dataTransfer!.setData("text/plain", r.dataset.taskId!); e.dataTransfer!.setData("application/x-lifeos-task", r.dataset.taskId!); requestAnimationFrame(() => r.classList.add("opacity-40")); };
    const over = (e: DragEvent) => { if (!drag) return; e.preventDefault(); const o = row(e.target); if (!o || o === drag || o.parentElement !== ul) return; const b = o.getBoundingClientRect(); ul.insertBefore(drag, e.clientY > b.top + b.height / 2 ? o.nextSibling : o); moved = true; };
    const drop = (e: DragEvent) => { if (drag) e.preventDefault(); };
    const end = async () => { const d = drag; drag = null; d?.classList.remove("opacity-40"); if (!d || !moved) return; const r = await setOrderAction(rows().map((x) => Number(x.dataset.taskId))); if (!r.ok) toast(r.error); router.refresh(); };
    ul.addEventListener("dragstart", start); ul.addEventListener("dragover", over); ul.addEventListener("drop", drop); ul.addEventListener("dragend", end);
    return () => { mo.disconnect(); ul.removeEventListener("dragstart", start); ul.removeEventListener("dragover", over); ul.removeEventListener("drop", drop); ul.removeEventListener("dragend", end); };
  }, [router]);
  return <ul ref={ref}>{children}</ul>;
}
