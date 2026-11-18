import Link from "next/link";
import { getWeather } from "@/lib/weather";
import { getNews } from "@/lib/news";
import { focusToday } from "@/lib/focus";
import { doneToday } from "@/lib/tasks";
import { nice } from "@/lib/time";
import { card } from "./ui";

export async function WeatherCard() {
  let w;
  try { w = await getWeather(); } catch { return <div className={card}><h2 className="font-semibold">Weather</h2><p className="text-sm text-neutral-500">Weather is unavailable right now.</p></div>; }
  if (!w) return <div className={card}><h2 className="font-semibold">Weather</h2><p className="text-sm text-neutral-500">Set your location in <Link className="text-indigo-600 underline dark:text-indigo-400" href="/settings">settings</Link>.</p></div>;
  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <div><div className="text-sm text-neutral-500">{w.place.split(",")[0]}</div><div className="text-4xl font-semibold">{w.temp}°</div><div className="text-sm text-neutral-500">{w.description} · feels {w.feels}° · {w.wind} km/h</div></div>
        <div className="text-6xl" aria-hidden>{w.icon}</div>
      </div>
      <ul className="mt-3 grid grid-cols-5 gap-1 text-center text-xs">
        {w.daily.map((d, i) => (
          <li key={d.date} className="rounded-lg bg-neutral-100 p-1.5 dark:bg-neutral-800" title={d.description}>
            <div className="text-neutral-500">{i === 0 ? "Today" : nice(d.date).split(",")[0]}</div>
            <div className="text-lg">{d.icon}</div><div>{d.hi}° <span className="text-neutral-500">{d.lo}°</span></div>
            <div className="text-sky-600 dark:text-sky-400">{d.rain}%</div>
          </li>))}
      </ul>
    </div>
  );
}

const ago = (t: number) => { if (!t) return ""; const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${Math.max(m, 1)}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
export async function NewsCard({ limit = 8 }: { limit?: number }) {
  const { items, errors } = await getNews(limit);
  return (
    <div className={card}>
      <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">News</h2><Link href="/news" className="text-sm text-indigo-600 dark:text-indigo-400">All →</Link></div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.link} className="text-sm"><a href={i.link} target="_blank" rel="noreferrer noopener" className="hover:underline">{i.title}</a>
            <span className="ml-2 text-xs text-neutral-500">{i.source} · {ago(i.date)}</span></li>))}
        {!items.length && <li className="text-sm text-neutral-500">No stories yet.</li>}
      </ul>
      {errors.length > 0 && <p className="mt-2 text-xs text-red-500">{errors.join(" · ")}</p>}
    </div>
  );
}

export function StatsCard() {
  const f = focusToday();
  return (
    <Link href="/focus" className={`${card} block hover:border-indigo-400`}>
      <h2 className="mb-1 font-semibold">Today so far</h2>
      <div className="flex gap-6"><div><div className="text-3xl font-semibold">{doneToday()}</div><div className="text-xs text-neutral-500">tasks done</div></div>
        <div><div className="text-3xl font-semibold">{f.minutes}<span className="text-base">m</span></div><div className="text-xs text-neutral-500">focus · {f.sessions} {f.sessions === 1 ? "session" : "sessions"}</div></div></div>
    </Link>
  );
}
