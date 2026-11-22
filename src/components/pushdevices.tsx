"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { removePushDeviceAction, removePushEndpointAction, savePushSubscriptionAction, testPushAction } from "@/lib/actions5";

export type Device = { id: number; endpoint: string; label: string; created_at: string; last_ok: string | null; last_error: string | null };
type Support = "checking" | "ok" | "unsupported" | "ios-install" | "insecure";

const PUSH_FLAG = "lifeos:push"; // also read by pwa.tsx
const setFlag = (on: boolean) => { try { if (on) localStorage.setItem(PUSH_FLAG, "1"); else localStorage.removeItem(PUSH_FLAG); } catch { /* private mode */ } };
export const keyBytes = (b64: string) => { const s = atob((b64 + "===".slice((b64.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
/** "Chrome on Mac", "Safari on iPhone": enough to tell your devices apart in the list. */
export function deviceLabel(ua = navigator.userAgent): string {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const app = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone ? " (app)" : "";
  return os ? `${br} on ${os}${app}` : `${br}${app}`;
}
const ready = () => Promise.race([navigator.serviceWorker.ready, new Promise<undefined>((r) => setTimeout(() => r(undefined), 6000))]);
const ago = (iso: string | null) => { if (!iso) return "never"; const d = new Date(iso.replace(" ", "T") + "Z"), m = Math.round((Date.now() - d.getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : d.toLocaleDateString(); };

/** Settings → Reminders: turn Web Push on for this device, see every device that has it, test, remove. */
export function PushDevices({ publicKey, devices }: { publicKey: string; devices: Device[] }) {
  const [support, setSupport] = useState<Support>("checking"), [mine, setMine] = useState<string | null>(null), [perm, setPerm] = useState("default"), [busy, go] = useTransition();
  useEffect(() => {
    if (!window.isSecureContext) return setSupport("insecure");
    const ios = /iPhone|iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setSupport(ios && !standalone ? "ios-install" : "unsupported");
    setSupport("ok"); setPerm(Notification.permission);
    void ready().then((reg) => reg?.pushManager.getSubscription()).then((s) => setMine(s?.endpoint ?? null)).catch(() => {});
  }, []);
  const registered = !!mine && devices.some((d) => d.endpoint === mine);

  const turnOn = () => go(async () => {
    const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission(); setPerm(p);
    if (p !== "granted") { toast("Notifications are blocked for this site. Allow them in the browser's site settings, then try again."); return; }
    const reg = await ready();
    if (!reg) { toast("The app's background helper isn't running yet. Reload the page and try again."); return; }
    try {
      let sub = await reg.pushManager.getSubscription();
      // A subscription made for different server keys (e.g. a restored database) can't be reused: replace it.
      const key = sub?.options?.applicationServerKey, want = keyBytes(publicKey);
      if (sub && key && !new Uint8Array(key).every((b, i) => b === want[i])) { await sub.unsubscribe(); sub = null; }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
      const r = await savePushSubscriptionAction(sub.toJSON() as never, deviceLabel());
      if (!r.ok) { toast(r.error); return; }
      setMine(sub.endpoint); setFlag(true); toast(r.message ?? "Push is on");
    } catch (e) { toast(`Couldn't turn push on: ${(e as Error).message}`); }
  });
  const turnOffHere = () => go(async () => {
    const reg = await ready(), sub = await reg?.pushManager.getSubscription();
    if (sub) { await removePushEndpointAction(sub.endpoint); await sub.unsubscribe().catch(() => false); }
    setMine(null); setFlag(false); toast("Push is off for this device");
  });
  const test = (endpoint?: string) => go(async () => { const r = await testPushAction(endpoint); toast(r.ok ? r.message ?? "Sent" : r.error); });
  const remove = (d: Device) => go(async () => {
    if (d.endpoint === mine) return turnOffHere();
    const r = await removePushDeviceAction(d.id); toast(r.ok ? r.message ?? "Removed" : r.error);
  });

  return (
    <div className="space-y-4 p-4 text-[13px]">
      <div className="flex flex-wrap items-center gap-3">
        {support === "checking" ? <span className="text-dim">Checking this browser…</span>
          : support === "insecure" ? <span className="text-warn">Push needs the app to be opened over https (or on localhost).</span>
          : support === "ios-install" ? <span className="text-warn">On iPhone and iPad, push only works in the installed app: tap Share, then Add to Home Screen, open LifeOS from there and come back here.</span>
          : support === "unsupported" ? <span className="text-warn">This browser doesn&apos;t support push notifications.</span>
          : registered && perm === "granted" ? <><span className="lozenge bg-ok/15 text-ok">On for this device</span><button className="btn" disabled={busy} onClick={() => test(mine!)}>Send a test</button><button className="btn" disabled={busy} onClick={turnOffHere}>Turn off here</button></>
          : <><button className="btn-primary" disabled={busy} onClick={turnOn}>Turn on push for this device</button>{perm === "denied" && <span className="text-danger">Blocked by the browser. Allow notifications for this site first.</span>}</>}
      </div>
      {devices.length > 0 && (
        <ul className="divide-y rounded-md border">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="font-medium">{d.label}</span>
              {d.endpoint === mine && <span className="lozenge bg-raise text-dim">This device</span>}
              <span className="text-xs text-dim">Added {ago(d.created_at)} · last delivered {ago(d.last_ok)}</span>
              {d.last_error && <span className="text-xs text-danger" title={d.last_error}>Last try failed: {d.last_error}</span>}
              <button className="btn ml-auto" disabled={busy} onClick={() => remove(d)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {devices.length > 1 && <button className="btn" disabled={busy} onClick={() => test()}>Test all devices</button>}
      <p className="text-xs text-dim">Task reminders (with Mark done and Snooze) and the morning brief arrive even when LifeOS is closed. They use the timing and snooze length from Browser reminders above, and respect quiet hours. Turn it on once on each phone or computer. Needs the background worker (<code className="rounded bg-raise px-1">npm run worker</code>). If your sign-in has expired, Mark done opens the task so you can finish it there.</p>
    </div>
  );
}
