import { Suspense } from "react";
import { AddTaskRow } from "@/components/addrow";
import { Panel } from "@/components/Panel";
import { SpotifyPanel } from "@/components/spotify";
import { PageHead, TaskGroups, bucket } from "@/components/tasks";
import { NewsPanel, OverviewCard, WeatherPanel } from "@/components/widgets";
import { focusToday } from "@/lib/focus";
import { doneToday, queryTasks } from "@/lib/tasks";
import { today, tz } from "@/lib/time";

export const dynamic = "force-dynamic";
const Skeleton = ({ h = "h-44", i = 0 }: { h?: string; i?: number }) => <Panel i={i} className={`${h} animate-pulse`}>{null}</Panel>;

export default function Today() {
  const t = today();
  const open = queryTasks();
  const overdue = open.filter((x) => x.due && x.due < t).length;
  const toDo = open.filter((x) => x.due && x.due <= t).length;
  const groups = bucket(open).filter((g) => g.label !== "Later").map((g) => (g.label === "No date" ? { ...g, label: "Inbox", tasks: g.tasks.slice(0, 6) } : g));
  const date = new Intl.DateTimeFormat("en-NZ", { timeZone: tz(), weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <>
      <PageHead title="Today" sub={<>{date} · {toDo ? `${toDo} ${toDo === 1 ? "task" : "tasks"} to do` : "nothing due"}</>} />
      <div className="grid items-start gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div><TaskGroups groups={groups} empty={<>You&apos;re all caught up. Enjoy the day.</>} /><AddTaskRow /></div>
        <aside className="space-y-4">
          <OverviewCard i={1} done={doneToday()} focus={focusToday().minutes} overdue={overdue} />
          <Suspense fallback={<Skeleton i={2} />}><WeatherPanel i={2} /></Suspense>
          <SpotifyPanel i={3} />
          <Suspense fallback={<Skeleton h="h-64" i={4} />}><NewsPanel i={4} limit={5} /></Suspense>
        </aside>
      </div>
    </>
  );
}
