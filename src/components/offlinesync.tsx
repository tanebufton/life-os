"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { pendingOps, replay, usePending } from "@/lib/offlinequeue";

const sw = (msg: object) => { try { void navigator.serviceWorker?.ready.then((r) => r.active?.postMessage(msg)); } catch { /* no service worker */ } };
export const offlineEnabled = () => { try { return localStorage.getItem("lifeos.offline") !== "0"; } catch { return true; } };
export const setOfflineEnabled = (on: boolean) => { try { localStorage.setItem("lifeos.offline", on ? "1" : "0"); } catch { /* ignore */ } sw({ type: "lifeos:offline-mode", on }); if (!on) sw({ type: "lifeos:offline-clear" }); };
export const clearOfflineCopies = () => sw({ type: "lifeos:offline-clear" });
const WARM = ["/", "/inbox", "/tasks", "/upcoming", "/board", "/more"];

/** Offline support in the app: sends changes queued while offline once you're back, tells you what's happening, and keeps copies of key pages ready. */
export function OfflineSync() {
  const router = useRouter(), pending = usePending(), [offline, setOffline] = useState(false);
  useEffect(() => {
    if (window.self !== window.top) return;
    setOffline(navigator.onLine === false); sw({ type: "lifeos:offline-mode", on: offlineEnabled() });
    const sync = async () => { if (navigator.onLine === false || !pendingOps().length) return; const r = await replay(); if (r.sent || r.dropped) { toast(r.sent ? `Synced ${r.sent} change${r.sent === 1 ? "" : "s"} made offline${r.dropped ? ` (${r.dropped} couldn't be applied)` : ""}` : `${r.dropped} change${r.dropped === 1 ? "" : "s"} made offline couldn't be applied`); router.refresh(); } };
    const on = () => { setOffline(false); void sync(); }, off = () => setOffline(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    const id = setInterval(() => void sync(), 20_000); void sync();
    // Keep a fresh copy of the main pages for offline use (at most every six hours, once things have settled).
    const t = setTimeout(() => { try { if (navigator.onLine && offlineEnabled() && Date.now() - Number(localStorage.getItem("lifeos.warm") ?? 0) > 6 * 3600_000) { localStorage.setItem("lifeos.warm", String(Date.now())); sw({ type: "lifeos:offline-warm", urls: WARM }); } } catch { /* ignore */ } }, 6000);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(id); clearTimeout(t); };
  }, [router]);
  if (!offline && !pending.length) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[55] flex flex-wrap items-center justify-center gap-x-2 border-b border-warn/40 bg-warn/15 px-4 py-1.5 text-[13px] text-warn md:left-[260px]">
      <b>{offline ? "You're offline." : "Syncing…"}</b>
      <span className="text-fg/80">{offline ? "You can keep working with the pages you've already opened." : ""}{pending.length ? `${offline ? " " : ""}${pending.length} change${pending.length === 1 ? " is" : "s are"} waiting to sync${offline ? " and will go through when you're back" : ""}.` : ""}</span>
    </div>
  );
}

/** Settings: keep pages available offline on this device, or clear what's stored. */
export function OfflineSettings() {
  const [on, setOn] = useState(true), [cleared, setCleared] = useState(false);
  useEffect(() => setOn(offlineEnabled()), []);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><div className="text-sm">Work offline</div><div className="text-xs text-mute">Keeps a copy of the pages you open on this device, and holds changes made without a connection until you&apos;re back. Never includes Settings.</div></div>
      <div className="flex items-center gap-2">
        <button type="button" role="switch" aria-checked={on} aria-label="Work offline" onClick={() => { const n = !on; setOn(n); setOfflineEnabled(n); }} className={`relative h-6 w-11 rounded-full transition ${on ? "bg-accent" : "bg-fg/20"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></button>
        <button type="button" className="btn !h-8 text-xs" onClick={() => { clearOfflineCopies(); setCleared(true); setTimeout(() => setCleared(false), 2500); }}>{cleared ? "Cleared" : "Clear saved pages"}</button>
      </div>
    </div>
  );
}
