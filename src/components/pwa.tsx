"use client";
import { useEffect } from "react";

const PUSH_FLAG = "lifeos:push", SYNCED = "lifeos:push-synced";
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } };

/**
 * Once a day, on a device that turned push on, re-send its subscription so the server's copy stays current (browsers rotate them).
 * If the device was removed in Settings meanwhile, push is turned off here too instead of quietly coming back.
 */
async function resyncPush(reg: ServiceWorkerRegistration) {
  if (get(PUSH_FLAG) !== "1" || !("PushManager" in window) || Notification.permission !== "granted") return;
  const last = Number(get(SYNCED) || 0); if (Date.now() - last < 86_400_000) return;
  const sub = await reg.pushManager.getSubscription(); if (!sub) { set(PUSH_FLAG, null); return; }
  const r = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json", "x-lifeos": "1" }, body: JSON.stringify({ sub: sub.toJSON(), resync: true }) });
  if (!r.ok) return;
  const j = (await r.json()) as { known?: boolean };
  if (j.known === false) { await sub.unsubscribe().catch(() => false); set(PUSH_FLAG, null); }
  set(SYNCED, String(Date.now()));
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !(location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) return;
    navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).then((reg) => resyncPush(reg)).catch(() => {});
  }, []);
  return null;
}
