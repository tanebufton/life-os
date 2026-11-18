import Link from "next/link";
import { Suspense } from "react";
import { FeatureGate } from "@/components/FeatureGate";
import { Avatar } from "@/components/Pill";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { ago } from "@/components/widgets";
import { getNews } from "@/lib/news";

export const dynamic = "force-dynamic";
async function Items({ src }: { src?: string }) {
  const { items, errors } = await getNews(100);
  const sources = [...new Set(items.map((i) => i.source))];
  const shown = src ? items.filter((i) => i.source === src) : items;
  const chip = (on: boolean) => `inline-flex h-7 items-center rounded-full border px-3 text-[13px] font-medium transition ${on ? "border-accent/40 bg-accent/10 text-accent" : "text-mute hover:bg-raise"}`;
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5"><Link href="/news" className={chip(!src)}>All</Link>{sources.map((s) => <Link key={s} href={`/news?src=${encodeURIComponent(s)}`} className={chip(src === s)}>{s}</Link>)}</div>
      <Panel i={1}>
        <ul className="divide-y">
          {shown.map((i) => (
            <li key={i.link}><a href={i.link} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-raise/70">
              <Avatar name={i.source} size={44} />
              <div className="min-w-0 flex-1"><div className="line-clamp-2 text-[15px] font-medium leading-snug">{i.title}</div><div className="mt-0.5 text-[13px] text-mute">{i.source}</div></div>
              <span className="self-start pt-1 text-xs text-dim">{ago(i.date)}</span></a></li>))}
          {!shown.length && <li className="px-4 py-12 text-center text-sm text-mute">No stories. Add feeds in <Link className="font-medium text-accent hover:underline" href="/settings">settings</Link>.</li>}
        </ul>
        {errors.length > 0 && <p className="border-t px-4 py-2 text-xs text-danger">{errors.join(" · ")}</p>}
      </Panel>
    </>
  );
}
export default async function News({ searchParams }: { searchParams: Promise<{ src?: string }> }) {
  const { src } = await searchParams;
  return (<FeatureGate feature="news"><div className="mx-auto max-w-3xl"><PageHead title="News" sub="Headlines from your feeds, refreshed every 10 minutes" />
    <Suspense fallback={<Panel className="h-72 animate-pulse">{null}</Panel>}><Items src={src} /></Suspense></div></FeatureGate>);
}
