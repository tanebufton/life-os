import { InstallApp } from "@/components/installapp";
import Link from "next/link";
import { headers } from "next/headers";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { CopyBox, RegenButton, TestNotify, TokenManager } from "@/components/settingsui";
import { FeatureSwitch } from "@/components/switch";
import { PageHead } from "@/components/tasks";
import { ThemeToggle } from "@/components/theme";
import { BrowserReminders } from "@/components/browserreminders";
import { browserNotifyConfig } from "@/lib/browsernotify";
import { saveVoiceProject, resetFeatures, saveCapacity, saveNotifySettings, saveTimezone } from "@/lib/actions";
import { MobileTabsEditor, SidebarEditor, TodayWidgetsEditor } from "@/components/layoutprefs";
import { parsePrefs } from "@/lib/sidebar";
import { MAX_TABS, NAV, resolveTabs, visiblePages } from "@/lib/nav";
import { WIDGETS, widgetOn } from "@/lib/widgets";
import { recentEmailImports } from "@/lib/email";
import { FEATURES, featureMap } from "@/lib/features";
import { imapConfigured } from "@/lib/imap";
import { getSetting } from "@/lib/settings";
import { tz } from "@/lib/time";
import { TelegramButtons } from "@/components/settingsui";
import { db } from "@/lib/db";
import { unarchiveProjectAction } from "@/lib/actions5";
import { BackupPanel } from "@/components/backupui";
import { ImportPanel } from "@/components/importpanel";
import * as Backup from "@/lib/backup";
import { addCalFeedAction, removeCalFeedAction, saveQuietHours, saveTelegramToken, saveWorkHours, syncCalendarsAction, telegramRegen, telegramUnlink } from "@/lib/actions3";
import { listFeeds as listCalFeeds } from "@/lib/calendar";
import { aiConfigured, aiModel } from "@/lib/ai";
import { tgChat, tgLinkCode, tgMode, tgSecret, tgToken } from "@/lib/telegram";
import { icalSecret, inboundSecret, listTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";
const TABS = [{ k: "general", label: "General" }, { k: "reminders", label: "Reminders" }, { k: "connect", label: "Connections" }, { k: "data", label: "Data" }];
const Code = ({ children }: { children: string }) => <pre className="overflow-x-auto rounded-md border bg-raise/60 p-2.5 text-xs leading-relaxed">{children}</pre>;
const Section = ({ id, title, desc, children, i = 0, tab, cur }: { id?: string; title: string; desc: string; children: React.ReactNode; i?: number; tab: string; cur: string }) => (tab !== cur ? null :
  <section id={id} className="rise grid scroll-mt-16 gap-4 border-b py-7 first:pt-0 last:border-b-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10" style={{ ["--i" as string]: i }}>
    <div><h2 className="text-[15px] font-semibold">{title}</h2><p className="mt-1 text-[13px] leading-relaxed text-mute">{desc}</p></div><div className="min-w-0">{children}</div>
  </section>
);

export default async function Settings({ searchParams }: { searchParams: Promise<{ err?: string; tab?: string }> }) {
  const sp = await searchParams, err = sp.err, tab = TABS.some((t) => t.k === sp.tab) ? sp.tab! : "general";
  const h = await headers();
  const origin = (process.env.LIFEOS_BASE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`).replace(/\/$/, "");
  const f = featureMap(), groups = [...new Set(FEATURES.map((x) => x.group))];
  const nv = (k: string, d = "") => getSetting(k) ?? d;
  return (
    <div className="max-w-4xl">
      <PageHead title="Settings" sub="Make LifeOS yours: switch features on or off, connect things, own your data" />
      <nav aria-label="Settings sections" className="mb-6 flex gap-0.5 overflow-x-auto border-b">
        {TABS.map((t) => <Link key={t.k} href={`/settings?tab=${t.k}`} aria-current={t.k === tab ? "page" : undefined} className={`-mb-px shrink-0 border-b-2 px-3.5 py-2 text-[14px] ${t.k === tab ? "border-accent font-medium text-fg" : "border-transparent text-mute hover:text-fg"}`}>{t.label}</Link>)}
      </nav>
      {err && <p className="mb-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">{err}</p>}

      <Section cur={tab} tab="general" i={0} title="Features" desc="Only keep what you use. Anything you switch off disappears everywhere: the sidebar, search, Today, the MCP server and the API. Your data is kept if you switch it back on.">
        <Panel>
          {groups.map((g) => (<div key={g}><div className="border-b bg-raise/40 px-4 py-1.5 text-xs font-semibold text-mute">{g}</div>
            {FEATURES.filter((x) => x.group === g).map((x) => (
              <div key={x.key} className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"><div className="min-w-0"><div className="text-[14px] font-medium">{x.label}</div><div className="text-xs text-mute">{x.desc}</div></div><FeatureSwitch k={x.key} on={f[x.key]} label={x.label} /></div>))}</div>))}
          <form action={resetFeatures} className="border-t px-4 py-2.5 text-right"><button className="text-xs text-mute hover:text-fg">Turn everything back on</button></form>
        </Panel>
        <p className="mt-2 text-xs text-dim">Always on: Today, Inbox, My tasks and Settings.</p>
      </Section>

      <Section cur={tab} tab="general" i={2} title="Time & capacity" desc="Decides what “today” means for due dates, repeats and reminders, and how much work fits in a day.">
        <Panel bodyClass="space-y-5 p-4">
          <form action={saveTimezone} className="space-y-1.5"><label className="text-[13px] font-medium">Timezone</label><div className="flex gap-2"><input name="timezone" defaultValue={tz()} className="field" /><button className="btn">Update</button></div></form>
          <form action={saveCapacity} className="space-y-1.5"><label className="text-[13px] font-medium">Daily capacity (hours)</label><div className="flex gap-2"><input name="hours" type="number" step="0.5" min="1" max="16" defaultValue={Number(nv("capacity_min", "360")) / 60} className="field !w-28" /><button className="btn">Save</button></div>
            <p className="text-xs text-dim">Today shows planned time (from task estimates) against this.</p></form>
        </Panel>
      </Section>

      <Section cur={tab} tab="general" id="layout" i={1} title="Layout" desc="Choose the tabs in your phone's bottom bar, and what shows on Today. Changes apply straight away.">
        <div className="space-y-5">
          <Panel title="Phone bottom bar" bodyClass="p-4">{(() => { const vis = visiblePages(f), chosen = resolveTabs(nv("mobile_tabs") || undefined, f), ids = chosen.map((c) => c.href), rest = vis.filter((p) => !ids.includes(p.href)); return <MobileTabsEditor items={[...chosen, ...rest].map((p) => ({ id: p.href, label: p.label, icon: p.icon, on: ids.includes(p.href) }))} />; })()}</Panel>
          <Panel title="Desktop sidebar" bodyClass="p-4"><SidebarEditor pages={visiblePages(f).map((p) => ({ href: p.href, label: p.label, icon: p.icon, key: p.key, group: p.group, hidden: p.hidden, feature: p.feature }))} prefs={parsePrefs(nv("sidebar") || undefined)} /></Panel>
          <Panel title="Today widgets" bodyClass="p-4">{(() => { let order: string[] = [], hidden: string[] = []; try { const p = nv("today_widgets") ? JSON.parse(nv("today_widgets")) : null; if (p) { order = p.order ?? []; hidden = p.hidden ?? []; } } catch {} const ids = WIDGETS.map((w) => w.id), full = [...order.filter((i: string) => ids.includes(i)), ...ids.filter((i) => !order.includes(i))]; return <TodayWidgetsEditor items={full.filter((id) => { const w = WIDGETS.find((x) => x.id === id)!; return widgetOn(w, (k) => f[k]); }).map((id) => { const w = WIDGETS.find((x) => x.id === id)!; return { id, label: w.label, on: !hidden.includes(id) }; })} />; })()}</Panel>
        </div>
      </Section>
      <Section cur={tab} tab="general" i={2} title="Appearance" desc="Light or dark. LifeOS follows your system until you pick one."><Panel bodyClass="flex items-center justify-between p-4"><span className="text-sm">Theme</span><ThemeToggle label className="border" /></Panel></Section>

      {f.reminders && (<>
        <Section cur={tab} tab="reminders" id="browser-reminders" i={2} title="Browser reminders" desc="A pop-up while LifeOS is open, with Mark done and Snooze buttons, like Outlook."><Panel>{(() => { const b = browserNotifyConfig(); return <BrowserReminders on={b.on} lead={b.lead} snooze={b.snooze} />; })()}</Panel></Section>
        <Section cur={tab} tab="reminders" id="reminders" i={3} title="Reminders & push" desc="Get a push when a task with a time is due, plus a morning brief and an evening habit nudge. Uses ntfy (free app, self-hostable) and/or any webhook (Slack, Discord, Home Assistant…).">
          <Panel><form action={saveNotifySettings} className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-[13px] font-medium">Server (ntfy)<input name="ntfy_url" defaultValue={nv("ntfy_url")} placeholder="https://ntfy.sh" className="field font-normal" /></label>
              <label className="space-y-1.5 text-[13px] font-medium">Topic (ntfy)<input name="ntfy_topic" defaultValue={nv("ntfy_topic")} placeholder="a-long-private-topic-name" className="field font-normal" /></label></div>
            <label className="block space-y-1.5 text-[13px] font-medium">Access token (ntfy) <span className="font-normal text-dim">(optional{nv("ntfy_token") ? ", already set" : ""})</span><input name="ntfy_token" type="password" placeholder={nv("ntfy_token") ? "••••••••" : "tk_…"} className="field font-normal" autoComplete="off" /></label>
            <label className="block space-y-1.5 text-[13px] font-medium">Webhook URL <span className="font-normal text-dim">(optional, receives JSON)</span><input name="webhook_url" defaultValue={nv("webhook_url")} placeholder="https://hooks.example.com/…" className="field font-normal" /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-[13px] font-medium">Morning brief at<input name="brief_time" type="time" defaultValue={nv("brief_time", "08:00")} className="field font-normal" /></label></div>
            <div className="flex flex-wrap items-center gap-3"><button className="btn-primary">Save</button><TestNotify /></div>
          </form>
          <div className="border-t px-4 py-3 text-xs text-mute">Reminders are sent by a small background process. Run <code className="rounded bg-raise px-1">npm run worker</code> alongside the app (a systemd unit or pm2 keeps it running).</div></Panel>
        </Section>
      </>)}

      <Section cur={tab} tab="connect" id="install" i={0} title="Install the app" desc="Put LifeOS on your phone or desktop like any other app."><div className="p-4"><InstallApp /></div></Section>

      {f.voice && (
        <Section cur={tab} tab="connect" id="extension" i={0} title="Chrome extension" desc="Record a voice memo from any tab without opening LifeOS. It speaks to your LifeOS with an API token, so it works from anywhere you can reach it.">
          <Panel bodyClass="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3"><a href="/api/extension" download className="btn-primary"><Icon name="download" size={14} />Download the extension</a><span className="text-xs text-mute">A small zip (about 20 KB). Chrome, Edge, Brave and other Chromium browsers.</span></div>
            <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-mute">
              <li>Unzip it somewhere you&apos;ll keep it (Chrome reads it from there).</li>
              <li>Open <code className="rounded bg-raise px-1">chrome://extensions</code>, switch on <b className="text-fg">Developer mode</b>, click <b className="text-fg">Load unpacked</b> and pick the <code className="rounded bg-raise px-1">lifeos-voice</code> folder.</li>
              <li>Open its options and paste this address plus an API token (create one under API &amp; calendar feed below).</li>
            </ol>
            <div><div className="mb-1 text-xs font-medium text-mute">Your LifeOS address</div><CopyBox value={origin} /></div>
            <form action={saveVoiceProject} className="space-y-1.5 border-t pt-4"><label className="text-[13px] font-medium" htmlFor="voice-project">Default project for voice memos</label>
              <div className="flex gap-2"><select id="voice-project" name="project" defaultValue={nv("voice_project")} className="field"><option value="">None</option>{(db.prepare("SELECT id, name FROM projects WHERE archived=0 ORDER BY name").all() as { id: number; name: string }[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="btn-primary">Save</button></div>
              <p className="text-xs text-dim">Used when a memo arrives without a project. You can also pick one in the extension&apos;s own options, which wins over this.</p></form>
          </Panel>
        </Section>)}

      {f.email && (
  
      <Section cur={tab} tab="connect" id="email" i={4} title="Email import" desc="Turn emails into tasks. Put quick-add syntax in the subject (“Pay invoice tomorrow #bills !high”) and it files itself.">
          <Panel title="Option 1 · Forward or webhook" bodyClass="space-y-3 px-4 pb-4">
            <p className="text-[13px] text-mute">POST any email to this URL. It understands Postmark, Mailgun and SendGrid inbound, plain JSON, or a raw message (what a Cloudflare Email Worker can send).</p>
            <CopyBox value={`${origin}/api/inbound/email?secret=${inboundSecret()}`} />
            <div className="flex items-center gap-2"><RegenButton which="inbound" /><span className="text-xs text-dim">Add a Cloudflare Access bypass policy for <code>/api/inbound/*</code>.</span></div>
          </Panel>
          <Panel title="Option 2 · Read a mailbox (IMAP)" i={1} className="mt-4" bodyClass="space-y-3 px-4 pb-4">
            <p className="flex items-center gap-2 text-[13px]"><span className={`h-2 w-2 rounded-full ${imapConfigured() ? "bg-ok" : "bg-dim"}`} />{imapConfigured() ? "Configured. The worker checks every two minutes." : "Not configured."}</p>
            <Code>{`LIFEOS_IMAP_HOST=imap.gmail.com\nLIFEOS_IMAP_USER=you@example.com\nLIFEOS_IMAP_PASS=<app password>\nLIFEOS_IMAP_MAILBOX=INBOX        # or a folder/label, e.g. LifeOS\nLIFEOS_IMAP_FLAGGED_ONLY=1       # only starred emails`}</Code>
            <p className="text-xs text-dim">Use an app password and a dedicated label or folder. Unread messages become tasks and are then marked read. Needs <code>npm run worker</code>.</p>
          </Panel>
          {recentEmailImports(5).length > 0 && <Panel title="Recently imported" i={2} className="mt-4"><ul className="pb-1.5">{recentEmailImports(5).map((m) => <li key={m.message_id} className="flex items-center gap-3 border-b px-4 py-2 text-[13px] last:border-b-0"><Icon name="mail" size={14} className="text-mute" /><span className="min-w-0 flex-1 truncate">{m.subject || "(no subject)"}</span><span className="text-xs text-dim">{m.received_at.slice(0, 10)}</span></li>)}</ul></Panel>}
        </Section>
      )}

      {f.api && (
        <Section cur={tab} tab="connect" id="api" i={5} title="API & calendar feed" desc="Let bots, iOS Shortcuts and scripts add and read tasks, and see your due dates in any calendar app.">
          <Panel title="API tokens"><TokenManager tokens={listTokens()} />
            <div className="border-t px-4 py-3"><p className="mb-2 text-xs text-mute">Example: add a task</p><Code>{`curl -X POST ${origin}/api/v1/tasks \\\n  -H "Authorization: Bearer lifeos_…" -H "Content-Type: application/json" \\\n  -d '{"text":"Call mum tomorrow at 5pm #family"}'`}</Code>
              <p className="mt-2 text-xs text-dim">Also: GET /api/v1/tasks, /search?q=, /brief · PATCH/DELETE /tasks/:id · POST /tasks/:id/complete</p></div></Panel>
          <Panel title="Calendar feed (iCal)" i={1} className="mt-4" bodyClass="space-y-3 px-4 pb-4">
            <p className="text-[13px] text-mute">Subscribe in Google Calendar, Apple Calendar or Outlook (“add calendar from URL”). Tasks with a date appear as events; repeats come through too.</p>
            <CopyBox value={`${origin}/api/ical/${icalSecret()}.ics`} /><div className="flex items-center gap-2"><RegenButton which="ical" /><span className="text-xs text-dim">Anyone with this link can read your task titles. Regenerate if it leaks.</span></div>
          </Panel>
        </Section>
      )}

      {f.planner && (
        <Section cur={tab} tab="reminders" id="planner" i={3} title="Planner & quiet hours" desc="Working hours bound the day planner. Quiet hours hold back push notifications; they go out when quiet hours end.">
          <Panel><div className="grid gap-4 p-4 sm:grid-cols-2">
            <form action={saveWorkHours} className="space-y-2"><div className="text-[13px] font-medium">Working hours</div><div className="flex items-center gap-2"><input type="time" name="work_start" defaultValue={nv("work_start", "09:00")} aria-label="Start" className="field" /><span className="text-mute">to</span><input type="time" name="work_end" defaultValue={nv("work_end", "17:30")} aria-label="End" className="field" /></div><button className="btn">Save</button></form>
            <form action={saveQuietHours} className="space-y-2"><div className="text-[13px] font-medium">Quiet hours <span className="font-normal text-dim">(blank to disable)</span></div><div className="flex items-center gap-2"><input type="time" name="quiet_start" defaultValue={nv("quiet_start")} aria-label="From" className="field" /><span className="text-mute">to</span><input type="time" name="quiet_end" defaultValue={nv("quiet_end")} aria-label="Until" className="field" /></div><button className="btn">Save</button></form>
          </div></Panel>
        </Section>
      )}

      {f.calendar && (
        <Section cur={tab} tab="connect" id="calendar" i={4} title="Calendar sync" desc="Show events from Google, Apple, Outlook or any calendar that gives you a private .ics link. Read-only, refreshed about every 15 minutes by the worker.">
          <Panel>
            <ul>{listCalFeeds().map((c) => <li key={c.id} className="flex items-center gap-3 border-b px-4 py-2.5 text-[13px]"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} /><div className="min-w-0 flex-1"><div className="truncate font-medium">{c.name}</div><div className={`truncate text-xs ${c.last_error ? "text-danger" : "text-mute"}`}>{c.last_error ? c.last_error : c.last_synced ? `Synced ${c.last_synced}` : "Not synced yet"}</div></div><form action={removeCalFeedAction.bind(null, c.id)}><button className="text-xs text-dim hover:text-danger">Remove</button></form></li>)}</ul>
            <form action={addCalFeedAction} className="space-y-2.5 p-4"><div className="flex gap-2"><input name="name" placeholder="Name" className="field !w-40" /><input type="color" name="color" defaultValue="#8b5cf6" aria-label="Colour" className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5" /><input name="url" required placeholder="https://…/basic.ics (or webcal://)" className="field" /></div><div className="flex gap-2"><button className="btn-primary">Add calendar</button></div></form>
            <div className="flex items-center gap-3 border-t px-4 py-3 text-xs text-mute"><form action={syncCalendarsAction}><button className="btn !py-1">Sync now</button></form>In Google Calendar: Settings → your calendar → “Secret address in iCal format”.</div>
          </Panel>
        </Section>
      )}

      {f.telegram && (
        <Section cur={tab} tab="connect" id="telegram" i={5} title="Telegram bot" desc="Message your own bot to add tasks, check today, tick habits or log spending. It only ever answers the one chat you link. Needs a public HTTPS address (your Cloudflare tunnel works).">
          <Panel bodyClass="space-y-4 p-4">
            <ol className="list-decimal space-y-1 pl-5 text-[13px] text-mute"><li>In Telegram, message <b className="text-fg">@BotFather</b>, send /newbot, and copy the token.</li><li>Paste it below{process.env.TELEGRAM_BOT_TOKEN ? " (already set by environment)" : ""} and press Connect webhook.</li><li>Send this to your bot to link your chat:</li></ol>
            <CopyBox value={`/start ${tgLinkCode()}`} />
            <form action={saveTelegramToken} className="flex gap-2"><input name="token" type="password" autoComplete="off" placeholder={tgToken() ? "•••••••• (saved)" : "123456:ABC…"} className="field" aria-label="Bot token" /><button className="btn">Save token</button></form>
            <TelegramButtons origin={origin} mode={tgMode()} />
            <div className="flex flex-wrap items-center gap-3 text-xs text-mute"><span>{tgChat() ? "Linked to a chat." : "Not linked yet."}</span>{tgChat() && <form action={telegramUnlink}><button className="underline">Unlink</button></form>}<form action={telegramRegen}><button className="underline">Regenerate link code &amp; webhook secret</button></form><span className="text-dim">Secret: …{tgSecret().slice(-4)}</span></div>
          </Panel>
        </Section>
      )}

      {f.ai && (
        <Section cur={tab} tab="connect" id="ai" i={6} title="AI assistant" desc="Smart paste, day planning and questions, powered by Claude. Task text is sent to Anthropic only when you press a button on the Assistant page.">
          <Panel bodyClass="space-y-1.5 p-4 text-[13px]"><div>{aiConfigured() ? <span className="text-ok">API key found.</span> : <span className="text-warn">No API key. Set <code className="rounded bg-raise px-1">ANTHROPIC_API_KEY</code> in the server environment and restart.</span>}</div><div className="text-mute">Model: <code className="rounded bg-raise px-1">{aiModel()}</code> (override with <code className="rounded bg-raise px-1">LIFEOS_AI_MODEL</code>)</div></Panel>
        </Section>
      )}



      <Section cur={tab} tab="data" id="backup" i={8} title="Backup to Cloudflare R2" desc="An encrypted copy of your database in your own R2 bucket, so losing this machine doesn't lose your data. Each backup is downloaded again and verified before it counts. Your local database stays the live one.">
        {(() => { const c = Backup.config(), st = Backup.status(); return (
          <Panel><BackupPanel init={{ account: (getSetting("backup_endpoint") ?? ""), bucket: c.bucket, keyId: c.keyId, prefix: c.prefix, keep: c.keep, hours: c.hours, hasSecret: !!c.secret, hasPass: !!c.passphrase, configured: Backup.configured(c), enabled: c.enabled, lastOk: st.lastOk, lastError: st.lastError, fromEnv: !!process.env.LIFEOS_BACKUP_ENDPOINT }} /></Panel>); })()}
      </Section>

      {(() => { const arch = db.prepare("SELECT id, name FROM projects WHERE archived=1 ORDER BY name").all() as { id: number; name: string }[]; return arch.length ? (
        <Section cur={tab} tab="data" id="archived" i={8} title="Archived projects" desc="Archived projects are hidden from the sidebar. Their tasks are kept.">
          <Panel><ul>{arch.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm last:border-b-0"><span className="truncate">{a.name}</span><form action={async () => { "use server"; await unarchiveProjectAction(a.id); }}><button className="btn !h-7 text-xs">Restore</button></form></li>)}</ul></Panel>
        </Section>) : null; })()}

      <Section cur={tab} tab="data" id="import" i={8} title="Import" desc="Bring your tasks and notes across from another app.">
        <Panel><ImportPanel /></Panel>
      </Section>

      <Section cur={tab} tab="data" id="data" i={8} title="Your data" desc="It's yours. Take a copy any time. Deleted tasks stay recoverable for 30 days.">
        <Panel bodyClass="divide-y">
          {[["JSON export", "Everything: tasks, habits, journal, focus history, settings (secrets left out).", "/api/export?format=json"], ["Tasks as CSV", "Open in Excel or Google Sheets.", "/api/export?format=csv"], ["Full database backup", "The raw SQLite file. Includes secrets, so keep it private.", "/api/export?format=db"]].map(([t, d, h]) => (
            <div key={t} className="flex items-center justify-between gap-4 px-4 py-3"><div><div className="text-[14px] font-medium">{t}</div><div className="text-xs text-mute">{d}</div></div><a href={h} className="btn shrink-0"><Icon name="download" size={15} />Download</a></div>))}
        </Panel>
      </Section>
    </div>
  );
}
