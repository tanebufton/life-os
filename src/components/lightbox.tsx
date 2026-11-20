"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

/**
 * A task in a pop-up, so you don't lose your place on the board. It shows the real task page (with the app chrome hidden), so everything works:
 * edit, subtasks, comments, delete. Closing it, or leaving the task (e.g. after deleting), brings you back to the board.
 */
export function TaskLightbox({ id, onClose: done }: { id: number; onClose: (changed: boolean) => void }) {
  const frame = useRef<HTMLIFrameElement>(null), dirty = useRef(false), closeRef = useRef(() => done(dirty.current)), onClose = () => done(dirty.current); closeRef.current = onClose;
  // The embedded page tells us when it saved something, so the board only reloads if it needs to.
  useEffect(() => { const m = (e: MessageEvent) => { if (e.origin === location.origin && e.data === "lifeos:changed") dirty.current = true; }; window.addEventListener("message", m); return () => window.removeEventListener("message", m); }, []);
  // The browser's Back (a swipe on a phone) closes the pop-up and stays on the board, instead of leaving the page.
  useEffect(() => {
    history.pushState({ ...(history.state ?? {}), lifeosLightbox: true }, "");
    let popped = false; const pop = () => { popped = true; closeRef.current(); };
    window.addEventListener("popstate", pop);
    return () => { window.removeEventListener("popstate", pop); if (!popped && history.state?.lifeosLightbox) history.back(); };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  // The task page navigates inside the frame without reloading it (e.g. after Delete), so watch where it is.
  useEffect(() => { const t = setInterval(() => { try { const w = frame.current?.contentWindow; if (w && w.location.pathname !== "about:blank" && !/^\/tasks\/\d+/.test(w.location.pathname)) onClose(); } catch { /* ignore */ } }, 400); return () => clearInterval(t); }, [onClose]);
  const onLoad = () => {
    try {
      const w = frame.current?.contentWindow; if (!w) return;
      if (!/^\/tasks\/\d+/.test(w.location.pathname)) { onClose(); return; } // deleted, or navigated away
      w.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); });
    } catch { /* cross-origin: leave it */ }
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-3 md:p-8" role="dialog" aria-modal="true" aria-label="Task" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex h-full max-h-[900px] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border bg-bg shadow-[0_20px_60px_rgb(0_0_0/0.35)]">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <Link href={`/tasks/${id}`} className="inline-flex items-center gap-1.5 text-[13px] text-mute hover:text-fg"><Icon name="ext" size={14} />Open full page</Link>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-mute hover:bg-raise hover:text-fg"><Icon name="x" size={16} /></button>
        </div>
        <iframe ref={frame} name="lifeos-embed" src={`/tasks/${id}`} title="Task" onLoad={onLoad} className="min-h-0 w-full flex-1 border-0 bg-bg" />
      </div>
    </div>
  );
}
