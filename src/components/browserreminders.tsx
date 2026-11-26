"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveBrowserNotifyAction, saveDefaultReminderAction } from "@/lib/actions5";

/** Settings for reminders that pop up in this browser while LifeOS is open. */
export function BrowserReminders({ on: initOn, lead: initLead, snooze: initSnooze }: { on: boolean; lead: number; snooze: number }) {
  const [on, setOn] = useState(initOn), [lead, setLead] = useState(String(initLead)), [snooze, setSnooze] = useState(String(initSnooze)), [perm, setPerm] = useState<string>("default"), [, go] = useTransition();
  useEffect(() => { setPerm("Notification" in window ? Notification.permission : "unsupported"); }, []);
  const save = (nextOn = on) => go(async () => { const r = await saveBrowserNotifyAction(nextOn, Number(lead), Number(snooze)); toast(r.ok ? "Saved" : r.error); });
  const turnOn = async () => {
    if (!("Notification" in window)) return toast("This browser doesn't support notifications.");
    const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission(); setPerm(p);
    if (p !== "granted") return toast("Notifications are blocked for this site. Allow them in the address bar's site settings, then try again.");
    setOn(true); save(true);
  };
  const test = async () => {
    const reg = await Promise.race([navigator.serviceWorker?.ready, new Promise<undefined>((r) => setTimeout(() => r(undefined), 4000))]);
    if (reg && Notification.permission === "granted") await reg.showNotification("LifeOS reminder", { body: "This is how a task reminder looks. Real ones have Mark done and Snooze buttons.", tag: "lifeos-test" });
    else toast("Turn reminders on first (and allow notifications).");
  };
  return (
    <div className="space-y-4 p-4 text-[13px]">
      <div className="flex flex-wrap items-center gap-3">
        {on && perm === "granted" ? <><span className="lozenge bg-ok/15 text-ok">On in this browser</span><button className="btn" onClick={() => { setOn(false); save(false); }}>Turn off</button><button className="btn" onClick={test}>Send a test</button></>
          : <><button className="btn-primary" onClick={turnOn}>Turn on browser reminders</button>{perm === "denied" && <span className="text-danger">Blocked by the browser. Allow notifications for this site first.</span>}{on && perm !== "granted" && perm !== "denied" && <span className="text-warn">On, but this browser hasn&apos;t allowed notifications yet.</span>}</>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 font-medium">Remind me before it&apos;s due (minutes)<input type="number" min={0} max={120} value={lead} onChange={(e) => setLead(e.target.value)} onBlur={() => save()} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className="field" /></label>
        <label className="space-y-1.5 font-medium">Snooze for (minutes)<input type="number" min={1} max={240} value={snooze} onChange={(e) => setSnooze(e.target.value)} onBlur={() => save()} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className="field" /></label>
      </div>
      <p className="text-xs text-dim">For tasks with a time. While LifeOS is open in a tab, a notification appears with <b>Mark done</b> and <b>Snooze</b> buttons. Each browser you use needs turning on once. Closed tabs can&apos;t notify; for that, turn on Push notifications below.</p>
    </div>
  );
}

/** The time used for reminders typed with a date but no time, and (if switched on) a nudge for tasks due today that have no time. */
export function DefaultReminder({ time: initTime, on: initOn }: { time: string; on: boolean }) {
  const [time, setTime] = useState(initTime || "09:00"), [on, setOn] = useState(initOn), [, go] = useTransition();
  const save = (t = time, o = on) => go(async () => { const r = await saveDefaultReminderAction(t, o); toast(r.ok ? "Saved" : r.error); });
  return (
    <div className="space-y-3 p-4 text-[13px]">
      <label className="block max-w-xs space-y-1.5 font-medium">Default reminder time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} onBlur={() => save()} className="field" /></label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); save(time, e.target.checked); }} className="mt-0.5 h-4 w-4" /><span>Also remind me at this time about each task due today that has no time of its own (and no reminder of its own)</span></label>
      <p className="text-xs text-dim">Add reminders to any task on its page (as many as you like, at any time), or as you type: <code>Call the bank friday remind me thursday at 3pm</code>, <code>remind me 30m before</code>. A reminder with a day but no time uses this time. They arrive the same way as other reminders: in an open tab, by push, ntfy, webhook or Telegram.</p>
    </div>
  );
}
