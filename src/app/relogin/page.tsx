"use client";
import { useEffect } from "react";
/** Opened in a new tab after the Access session expires. Reaching it means sign-in worked; it tells the original tab and closes itself. */
export default function Relogin() {
  useEffect(() => { try { const c = new BroadcastChannel("lifeos-auth"); c.postMessage("signed-in"); c.close(); } catch { /* old browser */ } localStorage.setItem("lifeos:signed-in", String(Date.now())); const t = setTimeout(() => window.close(), 1200); return () => clearTimeout(t); }, []);
  return <div className="mx-auto max-w-sm py-24 text-center"><h1 className="text-xl font-semibold">You&apos;re signed in again</h1><p className="mt-2 text-[14px] text-mute">Go back to your other LifeOS tab. Anything you hadn&apos;t saved is being saved now. You can close this tab.</p></div>;
}
