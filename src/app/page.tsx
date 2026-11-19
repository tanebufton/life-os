import Link from "next/link";
import { Suspense } from "react";
import { AddTaskRow } from "@/components/addrow";
import { Panel } from "@/components/Panel";
import { SpotifyPanel } from "@/components/spotify";
import { PageHead, TaskGroups, bucket } from "@/components/tasks";
import { EventsPanel, GoalsPanel, HabitsPanel, JournalPanel, MoneyPanel, PeoplePanel, RenewalsPanel } from "@/components/todaywidgets";
import { Icon } from "@/components/Icon";
import { NewsPanel, OverviewCard, WeatherPanel } from "@/components/widgets";
import { featureMap, isOn } from "@/lib/features";
import { resolveWidgets } from "@/lib/widgets";
import { focusToday } from "@/lib/focus";
import { getSetting } from "@/lib/settings";
import { doneToday, queryTasks } from "@/lib/tasks";
import { today, tz } from "@/lib/time";

export const dynamic = "force-dynamic";
const Skeleton = ({ h = "h-44", i = 0 }: { h?: string; i?: number }) => <Panel i={i} className={`${h} animate-pulse`}>{null}</Panel>;

export default function Today() {
  const t = today(), f = featureMap();
  const open = queryTasks();
  const overdue = open.filter((x) => x.due && x.due < t).length;
  const toDo = open.filter((x) => x.due && x.due <= t).length;
  const planned = open.filter((x) => x.due && x.due <= t).reduce((n, x) => n + (x.estimate ?? 0), 0);
  const widgets = resolveWidgets(getSetting("today_widgets"), isOn);
  const emailNew = f.email ? open.filter((x) => x.source === "email" && !x.due && !x.project_id).length : 0;
  // Undated tasks are "To do": the same tasks that sit in the board's To do column. Only tasks with no project AND no date are unsorted "Inbox" items, which have their own page.
  const unsorted = open.filter((x) => !x.project_id && !x.due).length, undated = open.filter((x) => !x.due && x.status_kind === "todo").length;
  const groups = bucket(open).filter((g) => g.label !== "Later").map((g) => (g.label === "No date" ? { ...g, label: "To do", tasks: g.tasks.slice(0, 8) } : g));
  const date = new Intl.DateTimeFormat("en-NZ", { timeZone: tz(), weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <>
      <PageHead title="Today" sub={<>{date} · {toDo ? `${toDo} ${toDo === 1 ? "task" : "tasks"} to do` : "nothing due"}</>}
        right={<>{f.planner && <Link href="/planner" className="btn"><Icon name="planner" size={15} className="text-mute" />Timeline</Link>}{f.review && <Link href="/review" className="btn"><Icon name="review" size={15} className="text-accent" />Plan my day</Link>}</>} />
      {emailNew > 0 && (
        <Link href="/inbox" className="rise mb-5 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-[14px] hover:bg-accent/10">
          <Icon name="mail" size={18} className="text-accent" /><span><b>{emailNew}</b> new {emailNew === 1 ? "task" : "tasks"} from email waiting in your inbox</span><Icon name="arrow" size={15} className="ml-auto text-accent" /></Link>)}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div><TaskGroups groups={groups} empty={<>You&apos;re all caught up. Enjoy the day.</>} />
          {undated > 8 && <Link href="/tasks" className="mt-2 inline-block px-2 text-xs text-accent hover:underline">+{undated - 8} more to do in My tasks</Link>}
          {unsorted > 0 && emailNew === 0 && <Link href="/inbox" className="mt-3 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-mute hover:bg-raise/60"><Icon name="inbox" size={15} className="text-accent" /><span><b className="text-fg">{unsorted}</b> unsorted in your Inbox (no project or date)</span><Icon name="arrow" size={13} className="ml-auto" /></Link>}
          <AddTaskRow /></div>
        <aside className="space-y-4">
          {widgets.map((id, i) => {
            switch (id) {
              case "glance": return <OverviewCard key={id} i={i + 1} done={doneToday()} focus={f.focus ? focusToday().minutes : undefined} overdue={overdue} planned={planned} capacity={Number(getSetting("capacity_min") ?? 360)} />;
              case "habits": return <HabitsPanel key={id} i={i + 1} />;
              case "journal": return <JournalPanel key={id} i={i + 1} />;
              case "money": return <MoneyPanel key={id} i={i + 1} />;
              case "events": return <EventsPanel key={id} i={i + 1} />;
              case "people": return <PeoplePanel key={id} i={i + 1} />;
              case "goals": return <GoalsPanel key={id} i={i + 1} />;
              case "subs": return <RenewalsPanel key={id} i={i + 1} />;
              case "weather": return <Suspense key={id} fallback={<Skeleton i={i + 1} />}><WeatherPanel i={i + 1} /></Suspense>;
              case "music": return <SpotifyPanel key={id} i={i + 1} />;
              case "news": return <Suspense key={id} fallback={<Skeleton h="h-64" i={i + 1} />}><NewsPanel i={i + 1} limit={5} /></Suspense>;
              default: return null;
            }
          })}
        </aside>
      </div>
    </>
  );
}
