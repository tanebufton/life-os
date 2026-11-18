import { Suspense } from "react";
import { QuickAdd, QuickAddHint, TaskList } from "@/components/tasks";
import { NewsCard, StatsCard, WeatherCard } from "@/components/widgets";
import { SpotifyWidget } from "@/components/spotify";
import { card } from "@/components/ui";
import { queryTasks } from "@/lib/tasks";
import { addDays, today, tz } from "@/lib/time";

export const dynamic = "force-dynamic";
const Skeleton = ({ h = "h-40" }: { h?: string }) => <div className={`${card} ${h} animate-pulse`} />;

export default function Today() {
  const t = today();
  const due = queryTasks({ dueBy: t });
  const doing = queryTasks({ status: "doing" }).filter((x) => !due.some((d) => d.id === x.id));
  const inbox = queryTasks({ inbox: true });
  const soon = queryTasks().filter((x) => x.due && x.due > t && x.due <= addDays(t, 7));
  const heading = new Intl.DateTimeFormat("en-NZ", { timeZone: tz(), weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">{heading}</h1>
      <QuickAdd autoFocus /><QuickAddHint />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className={card}><h2 className="font-semibold">Due &amp; overdue</h2><TaskList tasks={due} empty="Nothing due. 🎉" /></div>
          {doing.length > 0 && <div className={card}><h2 className="font-semibold">In progress</h2><TaskList tasks={doing} /></div>}
          {soon.length > 0 && <div className={card}><h2 className="font-semibold">Next 7 days</h2><TaskList tasks={soon} /></div>}
          <div className={card}><h2 className="font-semibold">Inbox</h2><TaskList tasks={inbox} empty="Inbox zero." /></div>
          <Suspense fallback={<Skeleton h="h-64" />}><NewsCard /></Suspense>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Suspense fallback={<Skeleton />}><WeatherCard /></Suspense>
          <StatsCard />
          <SpotifyWidget />
        </div>
      </div>
    </>
  );
}
