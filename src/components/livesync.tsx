"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps this tab up to date. The server says whenever anything changed (in another tab, on your phone, via the API or the worker);
 * we then refresh what's on screen, once the tab is visible. Changes made in this tab already refresh themselves, so those are skipped.
 */
export function LiveSync() {
  const router = useRouter();
  useEffect(() => {
    if (window.self !== window.top || typeof EventSource === "undefined") return; // not inside the task pop-up
    let seen: number | null = null, stale = false, timer: ReturnType<typeof setTimeout> | undefined, es: EventSource | null = null, posting = 0, lastPost = 0;
    const f = window.fetch;
    window.fetch = function (this: unknown, ...a: Parameters<typeof fetch>) {
      const post = (a[1]?.method ?? (a[0] instanceof Request ? a[0].method : "GET")) === "POST"; if (!post) return f.apply(this, a);
      posting++; lastPost = Date.now(); const done = () => { posting--; lastPost = Date.now(); }; const r = f.apply(this, a); r.then(done, done); return r;
    } as typeof fetch;
    const refresh = () => { if (document.visibilityState !== "visible") { stale = true; return; } stale = false; router.refresh(); };
    const onRev = (e: MessageEvent) => {
      const r = Number(e.data); if (seen === null) { seen = r; return; } if (r === seen) return; seen = r;
      if (posting > 0 || Date.now() - lastPost < 2500) return; // our own change: the action already refreshed this tab
      clearTimeout(timer); timer = setTimeout(refresh, 300);
    };
    const open = () => { es = new EventSource("/api/live"); es.onmessage = onRev; };
    open();
    const vis = () => { if (document.visibilityState === "visible" && stale) refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { window.fetch = f; es?.close(); clearTimeout(timer); document.removeEventListener("visibilitychange", vis); };
  }, [router]);
  return null;
}
