import { headers } from "next/headers";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { CopyBox, RegenButton, TestNotify, TokenManager } from "@/components/settingsui";
import { FeatureSwitch } from "@/components/switch";
import { PageHead } from "@/components/tasks";
import { ThemeToggle } from "@/components/theme";
import { addFeed, removeFeed, resetFeatures, saveCapacity, saveLocation, saveNotifySettings, saveTimezone, spotifyDisconnect } from "@/lib/actions";
import { recentEmailImports } from "@/lib/email";
import { FEATURES, featureMap } from "@/lib/features";
import { imapConfigured } from "@/lib/imap";
import { listFeeds } from "@/lib/news";
import { getSetting } from "@/lib/settings";
import { redirectUri, spotifyConfigured, spotifyConnected } from "@/lib/spotify";
import { tz } from "@/lib/time";
import { icalSecret, inboundSecret, listTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";
const Code = ({ children }: { children: string }) => <pre className="overflow-x-auto rounded-md border bg-raise/60 p-2.5 text-xs leading-relaxed">{children}</pre>;
const Section = ({ id, title, desc, children, i = 0 }: { id?: string; title: string; desc: string; children: React.ReactNode; i?: number }) => (
  <section id={id} className="rise grid scroll-mt-16 gap-4 border-b py-7 first:pt-0 last:border-b-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10" style={{ ["--i" as string]: i }}>
    <div><h2 className="text-[15px] font-semibold">{title}</h2><p className="mt-1 text-[13px] leading-relaxed text-mute">{desc}</p></div><div className="min-w-0">{children}</div>
  </section>
);

export default async function Settings({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const h = await headers();
  const origin = (process.env.LIFEOS_BASE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`).replace(/\/$/, "");
  const f = featureMap(), feeds = listFeeds(), groups = [...new Set(FEATURES.map((x) => x.group))];
  const nv = (k: string, d = "") => getSetting(k) ?? d;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHead title="Settings" sub="Make LifeOS yours: switch features on or off, connect things, own your data" />
      {err && <p className="mb-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">{err}</p>}

      <Section i={0} title="Features" desc="Only keep what you use. Anything you switch off disappears everywhere: the sidebar, search, Today, the MCP server and the API. Your data is kept if you switch it back on.">
        <Panel>
          {groups.map((g) => (<div key={g}><div className="border-b bg-raise/40 px-4 py-1.5 text-xs font-semibold text-mute">{g}</div>
            {FEATURES.filter((x) => x.group === g).map((x) => (
              <div key={x.key} className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"><div className="min-w-0"><div className="text-[14px] font-medium">{x.label}</div><div className="text-xs text-mute">{x.desc}</div></div><FeatureSwitch k={x.key} on={f[x.key]} label={x.label} /></div>))}</div>))}
          <form action={resetFeatures} className="border-t px-4 py-2.5 text-right"><button className="text-xs text-mute hover:text-fg">Turn everything back on</button></form>
        </Panel>
        <p className="mt-2 text-xs text-dim">Always on: Today, Inbox, My tasks and Settings.</p>
      </Section>

      <Section i={1} title="Location & time" desc="Used for the weather forecast and to decide what “today” means for due dates, repeats and reminders.">
        <Panel bodyClass="space-y-5 p-4">
          <form action={saveLocation} className="space-y-1.5"><label className="text-[13px] font-medium">City</label>
            <div className="flex gap-2"><input name="place" defaultValue={nv("place")} placeholder="e.g. Auckland" className="field" /><button className="btn-primary">Save</button></div><p className="text-xs text-dim">Saving a city also sets your timezone. Leave blank to clear.</p></form>
          <form action={saveTimezone} className="space-y-1.5"><label className="text-[13px] font-medium">Timezone</label><div className="flex gap-2"><input name="timezone" defaultValue={tz()} className="field" /><button className="btn">Update</button></div></form>
          <form action={saveCapacity} className="space-y-1.5"><label className="text-[13px] font-medium">Daily capacity (hours)</label><div className="flex gap-2"><input name="hours" type="number" step="0.5" min="1" max="16" defaultValue={Number(nv("capacity_min", "360")) / 60} className="field !w-28" /><button className="btn">Save</button></div>
            <p className="text-xs text-dim">Today shows planned time (from task estimates) against this.</p></form>
        </Panel>
      </Section>

      <Section i={2} title="Appearance" desc="Light or dark. LifeOS follows your system until you pick one."><Panel bodyClass="flex items-center justify-between p-4"><span className="text-sm">Theme</span><ThemeToggle label className="border" /></Panel></Section>

      {f.reminders && (
        <Section id="reminders" i={3} title="Reminders & push" desc="Get a push when a task with a time is due, plus a morning brief and an evening habit nudge. Uses ntfy (free app, self-hostable) and/or any webhook (Slack, Discord, Home Assistant…).">
          <Panel><form action={saveNotifySettings} className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-[13px] font-medium">ntfy server<input name="ntfy_url" defaultValue={nv("ntfy_url")} placeholder="https://ntfy.sh" className="field font-normal" /></label>
              <label className="space-y-1.5 text-[13px] font-medium">ntfy topic<input name="ntfy_topic" defaultValue={nv("ntfy_topic")} placeholder="a-long-private-topic-name" className="field font-normal" /></label></div>
            <label className="block space-y-1.5 text-[13px] font-medium">ntfy access token <span className="font-normal text-dim">(optional{nv("ntfy_token") ? ", already set" : ""})</span><input name="ntfy_token" type="password" placeholder={nv("ntfy_token") ? "••••••••" : "tk_…"} className="field font-normal" autoComplete="off" /></label>
            <label className="block space-y-1.5 text-[13px] font-medium">Webhook URL <span className="font-normal text-dim">(optional, receives JSON)</span><input name="webhook_url" defaultValue={nv("webhook_url")} placeholder="https://hooks.example.com/…" className="field font-normal" /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-[13px] font-medium">Morning brief at<input name="brief_time" type="time" defaultValue={nv("brief_time", "08:00")} className="field font-normal" /></label>
              <label className="space-y-1.5 text-[13px] font-medium">Habit nudge at{f.habits ? "" : " (habits off)"}<input name="habit_nudge_time" type="time" defaultValue={nv("habit_nudge_time", "20:00")} className="field font-normal" /></label></div>
            <div className="flex flex-wrap items-center gap-3"><button className="btn-primary">Save</button><TestNotify /></div>
          </form>
          <div className="border-t px-4 py-3 text-xs text-mute">Reminders are sent by a small background process. Run <code className="rounded bg-raise px-1">npm run worker</code> alongside the app (a systemd unit or pm2 keeps it running).</div></Panel>
        </Section>
      )}

      {f.email && (
        <Section id="email" i={4} title="Email import" desc="Turn emails into tasks. Put quick-add syntax in the subject (“Pay invoice tomorrow #bills !high”) and it files itself.">
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
        <Section id="api" i={5} title="API & calendar feed" desc="Let bots, iOS Shortcuts and scripts add and read tasks, and see your due dates in any calendar app.">
          <Panel title="API tokens"><TokenManager tokens={listTokens()} />
            <div className="border-t px-4 py-3"><p className="mb-2 text-xs text-mute">Example: add a task</p><Code>{`curl -X POST ${origin}/api/v1/tasks \\\n  -H "Authorization: Bearer lifeos_…" -H "Content-Type: application/json" \\\n  -d '{"text":"Call mum tomorrow at 5pm #family"}'`}</Code>
              <p className="mt-2 text-xs text-dim">Also: GET /api/v1/tasks, /search?q=, /brief · PATCH/DELETE /tasks/:id · POST /tasks/:id/complete · /habits · /journal</p></div></Panel>
          <Panel title="Calendar feed (iCal)" i={1} className="mt-4" bodyClass="space-y-3 px-4 pb-4">
            <p className="text-[13px] text-mute">Subscribe in Google Calendar, Apple Calendar or Outlook (“add calendar from URL”). Tasks with a date appear as events; repeats come through too.</p>
            <CopyBox value={`${origin}/api/ical/${icalSecret()}.ics`} /><div className="flex items-center gap-2"><RegenButton which="ical" /><span className="text-xs text-dim">Anyone with this link can read your task titles. Regenerate if it leaks.</span></div>
          </Panel>
        </Section>
      )}

      {f.news && (
        <Section i={6} title="News feeds" desc="RSS and Atom feeds that power the headlines on Today and the News page.">
          <Panel><ul>{feeds.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 border-b px-4 py-2.5"><div className="min-w-0"><div className="truncate text-sm font-medium">{x.title || x.url}</div>{x.title && <div className="truncate text-xs text-dim">{x.url}</div>}</div>
              <form action={removeFeed.bind(null, x.id)}><button className="rounded p-1 text-dim hover:bg-raise hover:text-danger" aria-label="Remove feed"><Icon name="x" size={16} /></button></form></li>))}</ul>
            <form action={addFeed} className="flex flex-wrap gap-2 p-4"><input name="url" type="url" required placeholder="https://example.com/feed.xml" className="field min-w-0 flex-1 basis-60" /><input name="title" placeholder="Name (optional)" className="field w-44" /><button className="btn-primary">Add feed</button></form></Panel>
        </Section>
      )}

      {f.music && (
        <Section i={7} title="Spotify" desc="Show what's playing and control playback from the dashboard. Needs a Spotify Premium account.">
          <Panel bodyClass="space-y-3 p-4">{!spotifyConfigured() ? (<><p className="text-sm text-mute">Create an app at developer.spotify.com, add this redirect URI, then set the environment variables and restart.</p><Code>{redirectUri()}</Code><Code>{`SPOTIFY_CLIENT_ID=…\nSPOTIFY_CLIENT_SECRET=…\nLIFEOS_BASE_URL=https://your.public.hostname`}</Code></>)
            : spotifyConnected() ? (<form action={spotifyDisconnect} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium text-ok"><Icon name="circleCheck" size={17} />Connected</span><button className="btn">Disconnect</button></form>)
            : (<div className="flex items-center justify-between text-sm"><span className="text-mute">Not connected</span><a href="/api/spotify/login" className="btn-primary">Connect Spotify</a></div>)}</Panel>
        </Section>
      )}

      <Section id="data" i={8} title="Your data" desc="It's yours. Take a copy any time. Deleted tasks stay recoverable for 30 days.">
        <Panel bodyClass="divide-y">
          {[["JSON export", "Everything: tasks, habits, journal, focus history, settings (secrets left out).", "/api/export?format=json"], ["Tasks as CSV", "Open in Excel or Google Sheets.", "/api/export?format=csv"], ["Full database backup", "The raw SQLite file. Includes secrets, so keep it private.", "/api/export?format=db"]].map(([t, d, h]) => (
            <div key={t} className="flex items-center justify-between gap-4 px-4 py-3"><div><div className="text-[14px] font-medium">{t}</div><div className="text-xs text-mute">{d}</div></div><a href={h} className="btn shrink-0"><Icon name="download" size={15} />Download</a></div>))}
        </Panel>
      </Section>
    </div>
  );
}
