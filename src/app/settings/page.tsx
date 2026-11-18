import { addFeed, removeFeed, saveLocation, saveTimezone, spotifyDisconnect } from "@/lib/actions";
import { btn, btn2, card, input } from "@/components/ui";
import { listFeeds } from "@/lib/news";
import { getSetting } from "@/lib/settings";
import { redirectUri, spotifyConfigured, spotifyConnected } from "@/lib/spotify";
import { tz } from "@/lib/time";

export const dynamic = "force-dynamic";
export default async function Settings({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const feeds = listFeeds();
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {err && <p className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{err}</p>}

      <section className={card}>
        <h2 className="mb-2 font-semibold">Location &amp; time</h2>
        <form action={saveLocation} className="flex gap-2"><input name="place" defaultValue={getSetting("place") ?? ""} placeholder="City, e.g. Auckland" className={`${input} min-w-0 flex-1`} /><button className={btn}>Save</button></form>
        <p className="mt-1 text-xs text-neutral-500">Used for weather. Saving a city also sets the timezone below. Leave blank to clear.</p>
        <form action={saveTimezone} className="mt-3 flex gap-2"><input name="timezone" defaultValue={tz()} className={`${input} min-w-0 flex-1`} aria-label="Timezone" /><button className={btn2}>Set</button></form>
        <p className="mt-1 text-xs text-neutral-500">Decides what “today” means for due dates and repeats.</p>
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold">News feeds</h2>
        <ul className="mb-3 divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          {feeds.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0 truncate">{f.title || f.url}<span className="ml-2 text-xs text-neutral-500">{f.title ? f.url : ""}</span></span>
              <form action={removeFeed.bind(null, f.id)}><button className="text-neutral-500 hover:text-red-500" aria-label="Remove feed">×</button></form></li>))}
        </ul>
        <form action={addFeed} className="flex flex-wrap gap-2"><input name="url" type="url" required placeholder="https://example.com/feed.xml" className={`${input} min-w-0 flex-1`} /><input name="title" placeholder="Name (optional)" className={`${input} w-40`} /><button className={btn}>Add</button></form>
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold">Spotify</h2>
        {!spotifyConfigured() ? (
          <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <p>Create an app at developer.spotify.com, add this redirect URI, then set the env vars and restart:</p>
            <pre className="overflow-x-auto rounded-lg bg-neutral-100 p-2 text-xs dark:bg-neutral-800">{redirectUri()}</pre>
            <pre className="overflow-x-auto rounded-lg bg-neutral-100 p-2 text-xs dark:bg-neutral-800">{`SPOTIFY_CLIENT_ID=…\nSPOTIFY_CLIENT_SECRET=…\nLIFEOS_BASE_URL=https://your.public.hostname`}</pre>
            <p className="text-xs">Playback control needs Spotify Premium.</p>
          </div>
        ) : spotifyConnected() ? (
          <form action={spotifyDisconnect} className="flex items-center justify-between text-sm"><span>Connected ✓</span><button className={btn2}>Disconnect</button></form>
        ) : (
          <div className="flex items-center justify-between text-sm"><span>Not connected</span><a href="/api/spotify/login" className={btn}>Connect Spotify</a></div>
        )}
      </section>
    </div>
  );
}
