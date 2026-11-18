import Link from "next/link";
import { Suspense } from "react";
import { card } from "@/components/ui";
import { getNews } from "@/lib/news";

export const dynamic = "force-dynamic";
const ago = (t: number) => { if (!t) return ""; const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${Math.max(m, 1)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

async function Items() {
  const { items, errors } = await getNews(60);
  return (
    <>
      <div className={card}>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {items.map((i) => (
            <li key={i.link} className="py-2.5"><a href={i.link} target="_blank" rel="noreferrer noopener" className="hover:underline">{i.title}</a>
              <div className="text-xs text-neutral-500">{i.source} · {ago(i.date)}</div></li>))}
          {!items.length && <li className="py-2 text-sm text-neutral-500">No stories. Add feeds in <Link className="text-indigo-600 underline" href="/settings">settings</Link>.</li>}
        </ul>
      </div>
      {errors.length > 0 && <p className="mt-3 text-sm text-red-500">Some feeds failed: {errors.join(" · ")}</p>}
    </>
  );
}
export default function News() {
  return (<><h1 className="mb-4 text-2xl font-semibold">News</h1><Suspense fallback={<div className={`${card} h-64 animate-pulse`} />}><Items /></Suspense></>);
}
