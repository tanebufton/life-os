import Link from "next/link";
import { getNews } from "@/lib/news";
import { getWeather } from "@/lib/weather";
import { fmtMinutes, nice } from "@/lib/dates";
import { Icon } from "./Icon";
import { Avatar } from "./Pill";
import { Panel } from "./Panel";

export function OverviewCard({ done, focus, overdue, planned, capacity, i = 0 }: { done: number; focus?: number; overdue: number; planned: number; capacity: number; i?: number }) {
  const cell = (v: React.ReactNode, l: string, cls = "") => <div className="px-4 py-3.5"><div className={`text-[26px] font-semibold leading-none tracking-tight ${cls}`}>{v}</div><div className="mt-1.5 text-xs text-mute">{l}</div></div>;
  const ratio = capacity ? planned / capacity : 0, tone = ratio > 1.25 ? "bg-danger" : ratio > 1 ? "bg-warn" : "bg-ok";
  return (
    <Panel title="Today at a glance" i={i}>
      <div className={`grid divide-x ${focus === undefined ? "grid-cols-2" : "grid-cols-3"}`}>
        {cell(done, "Completed", done ? "text-ok" : "")}{focus !== undefined && cell(<>{focus}<span className="text-sm font-medium text-mute"> min</span></>, "Focused")}{cell(overdue, "Overdue", overdue ? "text-danger" : "")}
      </div>
      {planned > 0 && (
        <div className="border-t px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-mute">Planned workload</span><span className={ratio > 1 ? "font-medium text-warn" : "text-mute"}>{fmtMinutes(planned)} of {fmtMinutes(capacity)}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-raise"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
          {ratio > 1 && <p className="mt-1.5 text-xs text-warn">Over by {fmtMinutes(planned - capacity)}. Consider moving something.</p>}
        </div>
      )}
    </Panel>
  );
}

export async function WeatherPanel({ i = 0 }: { i?: number }) {
  let w;
  try { w = await getWeather(); } catch { return <Panel title="Weather" i={i} bodyClass="px-4 pb-4 text-sm text-mute">Weather is unavailable right now.</Panel>; }
  if (!w) return <Panel title="Weather" i={i} bodyClass="px-4 pb-4 text-sm text-mute">Add your city to see the forecast. <Link href="/settings" className="font-medium text-accent hover:underline">Set location</Link></Panel>;
  const lo = Math.min(...w.daily.map((d) => d.lo)), hi = Math.max(...w.daily.map((d) => d.hi)), span = Math.max(hi - lo, 1);
  return (
    <Panel title={w.place.split(",")[0]} i={i} right={<span>{w.description}</span>}>
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <div><div className="text-[44px] font-light leading-none tracking-tight">{w.temp}°</div><div className="mt-1.5 text-xs text-mute">Feels like {w.feels}° · Wind {w.wind} km/h</div></div>
        <Icon name={w.icon} size={46} className="text-warn" />
      </div>
      <ul className="border-t px-4 py-1">
        {w.daily.map((d, k) => (
          <li key={d.date} className="grid grid-cols-[2.6rem_1.4rem_2.1rem_minmax(2.5rem,1fr)_4.1rem] items-center gap-2 py-1.5 text-[13px]">
            <span className="font-medium">{k === 0 ? "Today" : nice(d.date).split(",")[0]}</span>
            <Icon name={d.icon} size={17} className="text-mute" />
            <span className={`text-xs ${d.rain >= 40 ? "text-accent" : "text-dim"}`}>{d.rain >= 20 ? `${d.rain}%` : ""}</span>
            <span className="relative h-1 rounded-full bg-raise"><span className="absolute inset-y-0 rounded-full bg-gradient-to-r from-accent to-warn" style={{ left: `${((d.lo - lo) / span) * 100}%`, right: `${((hi - d.hi) / span) * 100}%` }} /></span>
            <span className="text-right tabular-nums">{d.hi}°<span className="ml-1.5 text-dim">{d.lo}°</span></span>
          </li>))}
      </ul>
    </Panel>
  );
}

export const ago = (t: number) => { if (!t) return ""; const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${Math.max(m, 1)}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
export async function NewsPanel({ limit = 6, i = 0 }: { limit?: number; i?: number }) {
  const { items, errors } = await getNews(limit);
  return (
    <Panel title="Headlines" i={i} right={<Link href="/news" className="font-medium text-accent hover:underline">See all</Link>}>
      <ul className="pb-1.5">
        {items.map((it) => (
          <li key={it.link}><a href={it.link} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-raise/70">
            <Avatar name={it.source} size={34} />
            <div className="min-w-0 flex-1"><div className="line-clamp-2 text-[13.5px] font-medium leading-snug">{it.title}</div><div className="mt-0.5 text-xs text-mute">{it.source}</div></div>
            <span className="self-start pt-0.5 text-[11px] text-dim">{ago(it.date)}</span></a></li>))}
        {!items.length && <li className="px-4 py-6 text-center text-sm text-mute">No stories yet. Add feeds in settings.</li>}
      </ul>
      {errors.length > 0 && <p className="border-t px-4 py-2 text-xs text-danger">{errors.join(" · ")}</p>}
    </Panel>
  );
}
