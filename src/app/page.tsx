import Link from "next/link";
import { Suspense } from "react";
import { AddTaskRow } from "@/components/addrow";
import { Panel } from "@/components/Panel";
import { SpotifyPanel } from "@/components/spotify";
import { PageHead, TaskGroups, bucket } from "@/components/tasks";
import { HabitsPanel, JournalPanel } from "@/components/todaywidgets";
import { Icon } from "@/components/Icon";
import { NewsPanel, OverviewCard, WeatherPanel } from "@/components/widgets";
import { featureMap } from "@/lib/features";
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
  const emailNew = open.filter((x) => x.source === "email" && !x.due && !x.project_id).length;
  const groups = bucket(open).filter((g) => g.label !== "Later").map((g) => (g.label === "No date" ? { ...g, label: "Inbox", tasks: g.tasks.slice(0, 6) } : g));
  const date = new Intl.DateTimeFormat("en-NZ", { timeZone: tz(), weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <>
      <PageHead title="Today" sub={<>{date} · {toDo ? `${toDo} ${toDo === 1 ? "task" : "tasks"} to do` : "nothing due"}</>}
        right={f.review ? <Link href="/review" className="btn"><Icon name="review" size={15} className="text-accent" />Plan my day</Link> : undefined} />
      {emailNew > 0 && (
        <Link href="/inbox" className="rise mb-5 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-[14px] hover:bg-accent/10">
          <Icon name="mail" size={18} className="text-accent" /><span><b>{emailNew}</b> new {emailNew === 1 ? "task" : "tasks"} from email waiting in your inbox</span><Icon name="arrow" size={15} className="ml-auto text-accent" /></Link>)}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div><TaskGroups groups={groups} empty={<>You&apos;re all caught up. Enjoy the day.</>} /><AddTaskRow /></div>
        <aside className="space-y-4">
          <OverviewCard i={1} done={doneToday()} focus={f.focus ? focusToday().minutes : undefined} overdue={overdue} planned={planned} capacity={Number(getSetting("capacity_min") ?? 360)} />
          {f.habits && <HabitsPanel i={2} />}
          {f.journal && <JournalPanel i={3} />}
          {f.weather && <Suspense fallback={<Skeleton i={4} />}><WeatherPanel i={4} /></Suspense>}
          {f.music && <SpotifyPanel i={5} />}
          {f.news && <Suspense fallback={<Skeleton h="h-64" i={6} />}><NewsPanel i={6} limit={5} /></Suspense>}
        </aside>
      </div>
    </>
  );
}
