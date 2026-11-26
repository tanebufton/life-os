import { getSetting } from "@/lib/settings";
import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { DayAdd } from "@/components/dayadd";
import { Panel } from "@/components/Panel";
import { PageHead, TaskRow } from "@/components/tasks";
import { addDays, fmtMinutes, monthStart, nice, weekday } from "@/lib/dates";
import { queryTasks } from "@/lib/tasks";
import { WeekGrid } from "@/components/weekgrid";
import { eventsBetween } from "@/lib/calendar";
import { isOn } from "@/lib/features";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
const dayLabel = (d: string, t: string) => (d === t ? "Today" : d === addDays(t, 1) ? "Tomorrow" : nice(d).replace(",", ""));

export default async function Upcoming({ searchParams }: { searchParams: Promise<{ view?: string; m?: string; d?: string; s?: string }> }) {
  const { view, m, d: wd, s: pick } = await searchParams;
  const t = today(), month = view === "month", week = view === "week";
  const all = queryTasks({ dueBy: addDays(t, 400), started: true });
  const tab = (on: boolean) => `rounded-md px-3 py-1 text-[13px] font-medium ${on ? "bg-panel shadow-sm" : "text-mute hover:text-fg"}`;
  const head = <PageHead title="Upcoming" sub={month ? "Month at a glance" : week ? "The week, with drag-to-reschedule" : "The next two weeks, day by day"} right={<div className="inline-flex rounded-lg bg-raise p-0.5"><Link href="/upcoming" className={tab(!month && !week)}>Agenda</Link><Link href="/upcoming?view=week" className={tab(week)}>Week</Link><Link href="/upcoming?view=month" className={tab(month)}>Month</Link></div>} />;

  if (week) {
    const anchor = wd && /^\d{4}-\d{2}-\d{2}$/.test(wd) ? wd : t, start = addDays(anchor, -((weekday(anchor) + 6) % 7)), dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const tasks = queryTasks({ dueBy: dates[6], started: true }).filter((x) => x.due! >= dates[0]), overdue = queryTasks({ dueBy: addDays(dates[0], -1), started: true }).filter((x) => x.due! < dates[0] && x.due! < t);
    const evs = isOn("calendar") ? eventsBetween(dates[0], dates[6]) : [];
    const days = dates.map((d) => ({ date: d, label: new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", weekday: "short" }).format(new Date(d + "T00:00:00Z")), num: Number(d.slice(8)), isToday: d === t,
      tasks: tasks.filter((x) => x.due === d).sort((a, b) => (a.due_time ?? "99").localeCompare(b.due_time ?? "99")).map((x) => ({ id: x.id, title: x.title, time: x.due_time, priority: x.priority, minutes: x.estimate })),
      events: evs.filter((e) => e.date === d).map((e) => ({ title: e.title, time: e.all_day ? null : e.start_time, color: (e as { color?: string }).color ?? "#8b5cf6" })) }));
    return (
      <FeatureGate feature="upcoming"><div>{head}
        <div className="mb-3 flex items-center gap-2"><Link href={`/upcoming?view=week&d=${addDays(start, -7)}`} className="btn" aria-label="Previous week">‹</Link><Link href="/upcoming?view=week" className="btn">This week</Link><Link href={`/upcoming?view=week&d=${addDays(start, 7)}`} className="btn" aria-label="Next week">›</Link><span className="ml-2 text-sm font-medium">{nice(dates[0]).replace(/^\w+, /, "")} – {nice(dates[6]).replace(/^\w+, /, "")}</span></div>
        {overdue.length > 0 && start <= t && <p className="mb-3 text-xs text-danger">{overdue.length} overdue task{overdue.length === 1 ? "" : "s"} not shown here. <Link href="/upcoming" className="underline">See them in the agenda</Link>.</p>}
        <WeekGrid days={days} capacity={Number(getSetting("capacity_min") ?? 360)} />
      </div></FeatureGate>
    );
  }
  if (!month) {
    const days = Array.from({ length: 14 }, (_, i) => addDays(t, i));
    const overdue = all.filter((x) => x.due! < t), by = (d: string) => all.filter((x) => x.due === d);
    return (
      <FeatureGate feature="upcoming"><div>{head}
        <div className="mb-6 grid grid-cols-7 gap-1.5">{days.slice(0, 7).map((d) => { const n = by(d).length, m = by(d).reduce((a, x) => a + (x.estimate ?? 0), 0), cap = Number(getSetting("capacity_min") ?? 360); return (
          <a key={d} href={`#d-${d}`} className={`rounded-xl border px-1 py-2 text-center transition hover:bg-raise ${d === t ? "border-accent/40 bg-accent/5" : ""}`}>
            <div className="text-[11px] font-medium text-mute">{new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", weekday: "short" }).format(new Date(d + "T00:00:00Z"))}</div>
            <div className="text-lg font-semibold leading-tight">{Number(d.slice(8))}</div>
            <div className={`mt-0.5 text-[11px] ${n ? "font-medium text-accent" : "text-dim"}`}>{n ? `${n} ${n === 1 ? "task" : "tasks"}` : "·"}</div>
            {m > 0 && <div className="mx-2 mt-1"><div className="h-1 overflow-hidden rounded-full bg-raise"><div className={`h-full rounded-full ${m > cap * 1.1 ? "bg-danger" : m > cap * 0.85 ? "bg-warn" : "bg-ok"}`} style={{ width: `${Math.min(100, (m / cap) * 100)}%` }} /></div></div>}</a>); })}</div>
        <div className="space-y-5">
          {overdue.length > 0 && <Panel title="Overdue" count={overdue.length} i={1}><ul>{overdue.map((x) => <TaskRow key={x.id} t={x} />)}</ul></Panel>}
          {days.map((d, i) => { const list = by(d), mins = list.reduce((n, x) => n + (x.estimate ?? 0), 0); return (
            <section key={d} id={`d-${d}`} className="rise scroll-mt-16" style={{ ["--i" as string]: i }}>
              <h2 className="flex items-baseline gap-2 border-b px-2 pb-1.5 text-[13px] font-semibold"><span className={d === t ? "text-ok" : ""}>{dayLabel(d, t)}</span><span className="font-normal text-dim">{list.length || ""}</span>{mins > 0 && <span className="ml-auto font-normal text-dim">{fmtMinutes(mins)} planned</span>}</h2>
              <ul>{list.map((x) => <TaskRow key={x.id} t={x} />)}</ul><DayAdd date={d} /></section>); })}
        </div></div>
      </FeatureGate>
    );
  }
  const base = m && /^\d{4}-\d{2}$/.test(m) ? `${m}-01` : monthStart(t);
  const next = monthStart(addDays(base.slice(0, 8) + "28", 7)), prev = monthStart(addDays(base, -1));
  const gridStart = addDays(base, -((weekday(base) + 6) % 7));
  const sel = pick && /^\d{4}-\d{2}-\d{2}$/.test(pick) ? pick : t;
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const label = new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(base + "T00:00:00Z"));
  return (
    <FeatureGate feature="upcoming">{head}
      <div className="mb-3 flex items-center gap-2"><Link href={`/upcoming?view=month&m=${prev.slice(0, 7)}`} className="btn !px-2" aria-label="Previous month">‹</Link>
        <h2 className="w-44 text-center text-[15px] font-semibold">{label}</h2><Link href={`/upcoming?view=month&m=${next.slice(0, 7)}`} className="btn !px-2" aria-label="Next month">›</Link>
        <Link href="/upcoming?view=month" className="btn ml-2">Today</Link></div>
      <div className="overflow-hidden rounded-xl border bg-panel">
        <div className="grid grid-cols-7 border-b bg-raise/50 text-center text-[11px] font-semibold text-mute">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1.5">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => { const list = all.filter((x) => x.due === d), inMonth = d.slice(0, 7) === base.slice(0, 7); return (
            <div key={d} className={`relative min-h-[52px] border-b border-r p-1 md:min-h-[104px] md:p-1.5 ${i % 7 === 6 ? "border-r-0" : ""} ${inMonth ? "" : "bg-raise/30 text-dim"} ${d === sel ? "bg-accent/10" : ""}`}>
              <Link href={`/upcoming?view=month&m=${base.slice(0, 7)}&s=${d}`} aria-label={`${nice(d)}, ${list.length} tasks`} className="absolute inset-0 md:hidden" />
              <div className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs ${d === t ? "bg-accent font-semibold text-ink" : ""}`}>{Number(d.slice(8))}</div>
              <div className="flex flex-wrap gap-0.5 md:hidden">{list.slice(0, 4).map((x) => <span key={x.id} className={`h-1.5 w-1.5 rounded-full ${x.due! < t ? "bg-danger" : "bg-accent"}`} />)}</div>
              <ul className="hidden space-y-0.5 md:block">{list.slice(0, 3).map((x) => <li key={x.id}><Link href={`/tasks/${x.id}`} className={`block truncate rounded px-1 text-[11px] leading-5 ${x.due! < t ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`} title={x.title}>{x.title}</Link></li>)}
                {list.length > 3 && <li className="px-1 text-[11px] text-mute">+{list.length - 3} more</li>}</ul></div>); })}
        </div>
      </div>
      <div className="mt-4 md:hidden"><h3 className="mb-1 px-1 text-[13px] font-semibold text-mute">{dayLabel(sel, t)}</h3>
        <ul className="rounded-xl border bg-panel px-1">{all.filter((x) => x.due === sel).map((x) => <TaskRow key={x.id} t={x} />)}{!all.some((x) => x.due === sel) && <li className="px-3 py-6 text-center text-sm text-mute">Nothing due.</li>}</ul></div>
    </FeatureGate>
  );
}
