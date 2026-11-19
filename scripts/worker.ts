// Background worker: reminders + morning brief (ntfy/webhook), and IMAP email import.  Run with: npm run worker
import { db } from "../src/lib/db";
import { isOn } from "../src/lib/features";
import { imapConfigured, pollMailbox } from "../src/lib/imap";
import { runReminders } from "../src/lib/reminders";
import { syncAll } from "../src/lib/calendar";
import { advanceSubscriptions } from "../src/lib/subs";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
let busy = false;
async function tick(n: number) {
  if (busy) return; busy = true;
  try {
    if (isOn("subscriptions")) { const n = advanceSubscriptions(); if (n) log(`logged ${n} subscription payment${n === 1 ? "" : "s"}`); }
    const sent = await runReminders(); if (sent) log(`sent ${sent} notification${sent === 1 ? "" : "s"}`);
    if (n % 30 === 0 && isOn("calendar")) { const r = await syncAll(); const c = Object.values(r).reduce((a, x) => a + x.events, 0); if (Object.keys(r).length) log(`synced ${Object.keys(r).length} calendar${Object.keys(r).length === 1 ? "" : "s"} (${c} events)`); }
    if (n % 4 === 0 && isOn("email") && imapConfigured()) { const r = await pollMailbox(); if (r.imported) log(`imported ${r.imported} email${r.imported === 1 ? "" : "s"} as tasks`); }
    if (n % 2880 === 0) db.prepare("DELETE FROM notifications_sent WHERE sent_at < datetime('now','-14 days')").run();
  } catch (e) { log("worker error:", (e as Error).message); } finally { busy = false; }
}
log(`LifeOS worker started · reminders ${isOn("reminders") ? "on" : "off"} · IMAP ${imapConfigured() ? "configured" : "not configured"}`);
let n = 0; void tick(n++); setInterval(() => void tick(n++), 30_000);
