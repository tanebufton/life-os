import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { ThemeToggle } from "@/components/theme";
import { addFeed, removeFeed, saveLocation, saveTimezone, spotifyDisconnect } from "@/lib/actions";
import { listFeeds } from "@/lib/news";
import { getSetting } from "@/lib/settings";
import { redirectUri, spotifyConfigured, spotifyConnected } from "@/lib/spotify";
import { tz } from "@/lib/time";

export const dynamic = "force-dynamic";
const Code = ({ children }: { children: string }) => <pre className="overflow-x-auto rounded-md border bg-raise p-2.5 text-xs">{children}</pre>;
const Section = ({ title, desc, children, i = 0 }: { title: string; desc: string; children: React.ReactNode; i?: number }) => (
  <section className="rise grid gap-4 border-b py-7 first:pt-0 last:border-b-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10" style={{ ["--i" as string]: i }}>
    <div><h2 className="text-[15px] font-semibold">{title}</h2><p className="mt-1 text-[13px] leading-relaxed text-mute">{desc}</p></div>
    <div>{children}</div>
  </section>
);

export default async function Settings({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const feeds = listFeeds();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHead title="Settings" sub="Location, appearance, news feeds and integrations" />
      {err && <p className="mb-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">{err}</p>}
      <Section i={0} title="Location & time" desc="Used for the weather forecast and to decide what “today” means for due dates and repeating tasks.">
        <Panel bodyClass="space-y-5 p-4">
          <form action={saveLocation} className="space-y-1.5"><label className="text-[13px] font-medium">City</label>
            <div className="flex gap-2"><input name="place" defaultValue={getSetting("place") ?? ""} placeholder="e.g. Auckland" className="field" /><button className="btn-primary">Save</button></div>
            <p className="text-xs text-dim">Saving a city also sets your timezone. Leave blank to clear.</p></form>
          <form action={saveTimezone} className="space-y-1.5"><label className="text-[13px] font-medium">Timezone</label>
            <div className="flex gap-2"><input name="timezone" defaultValue={tz()} className="field" /><button className="btn">Update</button></div></form>
        </Panel>
      </Section>
      <Section i={1} title="Appearance" desc="Choose a light or dark theme. LifeOS follows your system until you pick one."><Panel bodyClass="flex items-center justify-between p-4"><span className="text-sm">Theme</span><ThemeToggle label className="border" /></Panel></Section>
      <Section i={2} title="News feeds" desc="RSS and Atom feeds that power the headlines on Today and the News page.">
        <Panel>
          <ul>{feeds.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
              <div className="min-w-0"><div className="truncate text-sm font-medium">{f.title || f.url}</div>{f.title && <div className="truncate text-xs text-dim">{f.url}</div>}</div>
              <form action={removeFeed.bind(null, f.id)}><button className="rounded p-1 text-dim hover:bg-raise hover:text-danger" aria-label="Remove feed"><Icon name="x" size={16} /></button></form></li>))}</ul>
          <form action={addFeed} className="flex flex-wrap gap-2 p-4"><input name="url" type="url" required placeholder="https://example.com/feed.xml" className="field min-w-0 flex-1 basis-60" />
            <input name="title" placeholder="Name (optional)" className="field w-44" /><button className="btn-primary">Add feed</button></form>
        </Panel>
      </Section>
      <Section i={3} title="Spotify" desc="Show what's playing and control playback from the dashboard. Needs a Spotify Premium account.">
        <Panel bodyClass="space-y-3 p-4">
          {!spotifyConfigured() ? (<>
            <p className="text-sm text-mute">Create an app at developer.spotify.com, add this redirect URI, then set the environment variables and restart.</p>
            <Code>{redirectUri()}</Code><Code>{`SPOTIFY_CLIENT_ID=…\nSPOTIFY_CLIENT_SECRET=…\nLIFEOS_BASE_URL=https://your.public.hostname`}</Code></>
          ) : spotifyConnected() ? (
            <form action={spotifyDisconnect} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium text-ok"><Icon name="circleCheck" size={17} />Connected</span><button className="btn">Disconnect</button></form>
          ) : (
            <div className="flex items-center justify-between text-sm"><span className="text-mute">Not connected</span><a href="/api/spotify/login" className="btn-primary">Connect Spotify</a></div>
          )}
        </Panel>
      </Section>
    </div>
  );
}
