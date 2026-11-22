// Background worker: reminders + morning brief (Web Push/ntfy/webhook), and IMAP email import.  Run with: npm run worker
import { db } from "../src/lib/db";
import { isOn } from "../src/lib/features";
import { imapConfigured, pollMailbox } from "../src/lib/imap";
import { runReminders } from "../src/lib/reminders";
import { backupIfDue } from "../src/lib/backup";
import { notify } from "../src/lib/notify";
import { getSetting, setSetting } from "../src/lib/settings";
import { pollOnce, tgMode, tgToken } from "../src/lib/telegram";
import { pruneActivity, setProcessActor } from "../src/lib/activity";
import { syncAll } from "../src/lib/calendar";
import { runBoardAutomations } from "../src/lib/automations";
import { listDevices } from "../src/lib/webpush";

setProcessActor("worker");
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
let busy = false;
async function tick(n: number) {
  if (busy) return; busy = true;
  try {
    const mv = runBoardAutomations({ force: true }); if (mv) log(`board automations moved ${mv} card${mv === 1 ? "" : "s"}`);
    const sent = await runReminders(); if (sent) log(`sent ${sent} notification${sent === 1 ? "" : "s"}`);
    if (n % 30 === 0 && isOn("calendar")) { const r = await syncAll(); const c = Object.values(r).reduce((a, x) => a + x.events, 0); if (Object.keys(r).length) log(`synced ${Object.keys(r).length} calendar${Object.keys(r).length === 1 ? "" : "s"} (${c} events)`); }
    if (n % 20 === 0) { const b = await backupIfDue(); if (b.ran) { if (b.error) { log("backup failed:", b.error); const d = new Date().toISOString().slice(0, 10); if (getSetting("backup_alert_day") !== d) { setSetting("backup_alert_day", d); await notify({ title: "LifeOS backup failed", body: b.error, tags: ["warning"] }).catch(() => {}); } } else log("backup completed and verified"); } }
    if (n % 4 === 0 && isOn("email") && imapConfigured()) { const r = await pollMailbox(); if (r.imported) log(`imported ${r.imported} email${r.imported === 1 ? "" : "s"} as tasks`); }
    if (n % 2880 === 0) pruneActivity(365);
    if (n % 2880 === 0) db.prepare("DELETE FROM notifications_sent WHERE sent_at < datetime('now','-14 days')").run();
  } catch (e) { log("worker error:", (e as Error).message); } finally { busy = false; }
}
log(`LifeOS worker started · reminders ${isOn("reminders") ? "on" : "off"} · push devices ${listDevices().length} · IMAP ${imapConfigured() ? "configured" : "not configured"}`);
let n = 0; void tick(n++); setInterval(() => void tick(n++), 30_000);

// Telegram long-polling runs in its own loop (a poll waits up to ~25 s for a message, which would stall the 30 s tick).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
void (async () => {
  let wait = 2000;
  for (;;) {
    try {
      if (isOn("telegram") && tgToken() && tgMode() === "polling") { await pollOnce(25); wait = 2000; } else await sleep(10_000);
    } catch (e) { log("telegram polling:", (e as Error).message); await sleep(wait); wait = Math.min(wait * 2, 60_000); }
  }
})();
