"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { clearDraftIfSame, saveDraft } from "@/lib/drafts";

export type Health = "ok" | "expired" | "offline" | "unreachable";
/** Distinguish "your Cloudflare Access session ended" from "you're offline" from "the server is down". */
export async function probe(): Promise<Health> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  try {
    const r = await fetch("/api/ping", { redirect: "manual", cache: "no-store" });
    if (r.type === "opaqueredirect" || r.status === 401 || r.status === 403) return "expired";
    if (r.ok) return (r.headers.get("content-type") ?? "").includes("json") ? "ok" : "expired"; // an HTML 200 is a login page
    return "unreachable";
  } catch { return "unreachable"; }
}
const isOk = (r: unknown) => !(r && typeof r === "object" && "ok" in r && (r as { ok: unknown }).ok === false);
export type Guarded<T> = { saved: boolean; result?: T; reason?: "error" | Exclude<Health, "ok"> };
type Ctx = { health: Health; guarded: <T>(key: string, draft: unknown, fn: () => Promise<T>, onRecovered?: () => void) => Promise<Guarded<T>> };
const C = createContext<Ctx>({ health: "ok", guarded: async (_k, _d, fn) => { try { const result = await fn(); return { saved: isOk(result), result }; } catch { return { saved: false, reason: "error" }; } } });
export const useSession = () => useContext(C);

/** Mounted once in the layout. Keeps unsaved work in local storage, shows a banner when the session ends, and retries the saves once it's back. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<Health>("ok"), [pending, setPending] = useState(0), retries = useRef(new Map<string, { fn: () => Promise<unknown>; snap: string; done?: () => void }>()), busy = useRef(false);
  const flush = useCallback(async () => {
    if (busy.current) return; busy.current = true; let n = 0;
    try { for (const [key, r] of [...retries.current]) { try { const res = await r.fn(); if (isOk(res)) { clearDraftIfSame(key, r.snap); retries.current.delete(key); r.done?.(); n++; } } catch { break; } } }
    finally { busy.current = false; setPending(retries.current.size); }
    if (n) toast(`Saved ${n} change${n === 1 ? "" : "s"} you made while signed out`);
  }, []);
  const check = useCallback(async () => { const h = await probe(); setHealth(h); if (h === "ok" && retries.current.size) await flush(); return h; }, [flush]);
  const guarded: Ctx["guarded"] = useCallback(async (key, draft, fn, onRecovered) => {
    const snap = JSON.stringify(draft); saveDraft(key, draft);
    try { const result = await fn(); const ok = isOk(result); if (ok) { clearDraftIfSame(key, snap); retries.current.delete(key); setPending(retries.current.size); } return { saved: ok, result }; }
    catch {
      const h = await probe(); if (h === "ok") return { saved: false, reason: "error" as const };
      setHealth(h); retries.current.set(key, { fn, snap, done: onRecovered }); setPending(retries.current.size); return { saved: false, reason: h };
    }
  }, []);
  useEffect(() => {
    if (health === "ok") return; const id = setInterval(() => void check(), 4000), on = () => void check();
    window.addEventListener("online", on); window.addEventListener("focus", on);
    return () => { clearInterval(id); window.removeEventListener("online", on); window.removeEventListener("focus", on); };
  }, [health, check]);
  useEffect(() => {
    let ch: BroadcastChannel | null = null; try { ch = new BroadcastChannel("lifeos-auth"); ch.onmessage = () => void check(); } catch { /* unsupported */ }
    const st = (e: StorageEvent) => { if (e.key === "lifeos:signed-in") void check(); }; window.addEventListener("storage", st);
    const off = () => void probe().then((h) => h !== "ok" && setHealth(h)); window.addEventListener("offline", off);
    const bu = (e: BeforeUnloadEvent) => { if (retries.current.size) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", bu);
    return () => { ch?.close(); window.removeEventListener("storage", st); window.removeEventListener("offline", off); window.removeEventListener("beforeunload", bu); };
  }, [check]);
  // Don't wait for a save to fail: look when the tab comes back into view and every minute. If the session ended and there's nothing unsaved, go straight to the Cloudflare login.
  useEffect(() => {
    if (window.self !== window.top) return; // never inside an embedded frame (the desktop task pop-up); only the page itself checks
    let last = 0;
    const editing = () => { const a = document.activeElement as HTMLInputElement | null; return !!a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && !!a.value; };
    const run = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 15_000) return; last = Date.now();
      if ((await check()) !== "expired" || retries.current.size || editing()) return; // with unsaved work, the banner stays and nothing is lost
      try { const t = Number(sessionStorage.getItem("lifeos:autologin") ?? 0); if (Date.now() - t < 30_000) return; sessionStorage.setItem("lifeos:autologin", String(Date.now())); } catch { /* ignore */ }
      location.reload();
    };
    const go = () => void run(), id = setInterval(go, 60_000);
    document.addEventListener("visibilitychange", go); window.addEventListener("focus", go); window.addEventListener("pageshow", go); go();
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", go); window.removeEventListener("focus", go); window.removeEventListener("pageshow", go); };
  }, [check]);
  const value = useMemo(() => ({ health, guarded }), [health, guarded]);
  const msg = { expired: "Your session has expired.", offline: "You're offline.", unreachable: "Can't reach LifeOS right now." }[health as Exclude<Health, "ok">];
  return (
    <C.Provider value={value}>
      {health !== "ok" && health !== "offline" && (
        <div role="alert" className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warn/40 bg-warn/15 px-4 py-2 text-[13px] text-warn">
          <b>{msg}</b><span className="text-fg/80">{pending ? `${pending} unsaved change${pending === 1 ? " is" : "s are"} kept safely in this browser and will save automatically.` : "Nothing is lost. Your work is kept in this browser."}</span>
          <span className="ml-auto flex gap-2">{health === "expired" && <button className="btn !h-7 !py-0 text-xs" onClick={() => window.open("/relogin", "_blank")}>Sign in again</button>}<button className="btn !h-7 !py-0 text-xs" onClick={() => void check()}>Retry now</button></span>
        </div>
      )}
      {children}
    </C.Provider>
  );
}
/** Banner offering to restore unsaved text found in this browser. */
export function RestoreBanner({ at, onRestore, onDiscard, what = "changes" }: { at: string; onRestore: () => void; onDiscard: () => void; what?: string }) {
  return <div role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] text-warn"><span>Unsaved {what} from {at} were found in this browser.</span><span className="ml-auto flex gap-2"><button className="btn !h-7 !py-0 text-xs" onClick={onRestore}>Restore</button><button className="text-xs underline" onClick={onDiscard}>Discard</button></span></div>;
}
