import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { Icon } from "@/components/Icon";
import { JournalEditor, MOODS, MoodPicker } from "@/components/mood";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { addDays } from "@/lib/dates";
import { getEntry, journalStreak, listEntries, moodSeries } from "@/lib/journal";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export default async function Journal({ searchParams }: { searchParams: Promise<{ date?: string; q?: string }> }) {
  const { date: d, q } = await searchParams, t = today();
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= t ? d : t;
  const e = getEntry(date), entries = listEntries({ q, limit: 40 }), series = moodSeries(30, t), streak = journalStreak(t);
  const pretty = (s: string) => new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(s + "T00:00:00Z"));
  return (
    <FeatureGate feature="journal">
      <PageHead title="Journal" sub={`${streak ? `${streak}-day writing streak · ` : ""}One honest paragraph a day beats a perfect entry never written.`} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rise">
          <div className="mb-3 flex items-center gap-2"><Link href={`/journal?date=${addDays(date, -1)}`} className="btn !px-2" aria-label="Previous day">‹</Link>
            <h2 className="flex-1 text-[17px] font-semibold">{date === t ? "Today" : pretty(date)}<span className="ml-2 text-[13px] font-normal text-mute">{date === t ? pretty(date) : ""}</span></h2>
            {date < t && <Link href={`/journal?date=${addDays(date, 1)}`} className="btn !px-2" aria-label="Next day">›</Link>}{date !== t && <Link href="/journal" className="btn">Today</Link>}</div>
          <div className="mb-4"><MoodPicker key={date} date={date} value={e?.mood ?? null} /></div>
          <JournalEditor date={date} initial={e?.body ?? ""} />
        </div>
        <aside className="space-y-4">
          <Panel title="Mood, last 14 days" i={1}>
            <div className="px-4 pb-4">
              <div className="flex h-24 items-end gap-1.5">{series.slice(-14).map((x) => (
                <div key={x.date} className="flex h-full flex-1 flex-col justify-end" title={`${x.date}${x.mood ? `: ${MOODS[x.mood - 1]}` : ": no entry"}`}>
                  <div className={`w-full rounded-t ${x.mood ? "bg-accent" : "bg-fg/10"}`} style={{ height: x.mood ? `${(x.mood / 5) * 100}%` : "6%", opacity: x.mood ? 0.35 + x.mood * 0.13 : 1 }} /></div>))}</div>
              <div className="mt-1.5 flex justify-between text-[10px] text-dim"><span>14 days ago</span><span>today</span></div>
            </div>
          </Panel>
          <Panel title="Past entries" count={entries.length} i={2}>
            <form className="px-3 pb-2"><input name="q" defaultValue={q} placeholder="Search entries" className="field" /></form>
            <ul className="max-h-[420px] overflow-y-auto pb-1.5">{entries.map((x) => (
              <li key={x.date}><Link href={`/journal?date=${x.date}`} className={`block border-b px-4 py-2.5 last:border-b-0 hover:bg-raise/60 ${x.date === date ? "bg-raise/60" : ""}`}>
                <div className="flex items-center justify-between text-xs"><span className="font-medium">{pretty(x.date)}</span>{x.mood && <span className="inline-flex items-center gap-1 text-mute"><Icon name={`mood${x.mood}`} size={13} />{MOODS[x.mood - 1]}</span>}</div>
                {x.body && <p className="mt-0.5 line-clamp-2 text-[13px] text-mute">{x.body}</p>}</Link></li>))}
              {!entries.length && <li className="px-4 pb-3 text-sm text-mute">{q ? "No matches." : "Your entries will show up here."}</li>}</ul>
          </Panel>
        </aside>
      </div>
    </FeatureGate>
  );
}
