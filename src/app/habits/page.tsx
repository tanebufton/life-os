import { FeatureGate } from "@/components/FeatureGate";
import { HabitCheck, WeekDots } from "@/components/habitui";
import { Heatmap } from "@/components/heatmap";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { addHabit, archiveHabitAction } from "@/lib/actions";
import { addDays, weekday } from "@/lib/dates";
import { habitStats, listHabits } from "@/lib/habits";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
const DAYS = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]];
const stat = (v: React.ReactNode, l: string, cls = "") => <div><div className={`text-xl font-semibold leading-none ${cls}`}>{v}</div><div className="mt-1 text-[11px] text-mute">{l}</div></div>;

export default function Habits() {
  const t = today(), habits = listHabits();
  return (
    <FeatureGate feature="habits">
      <PageHead title="Habits" sub="Small things, done consistently. Streaks skip the days a habit isn't scheduled." />
      <div className="mx-auto max-w-3xl space-y-4">
        {habits.map((h, i) => {
          const st = habitStats(h, t), scheduled = h.days.includes(weekday(t));
          const cells = Array.from({ length: 84 }, (_, k) => { const d = addDays(t, k - 83); return { date: d, count: st.done.has(d) ? 1 : 0 }; });
          const hex = h.color.replace("#", ""), rgb = [0, 2, 4].map((o) => parseInt(hex.slice(o, o + 2), 16)).join(" ");
          return (
            <Panel key={h.id} i={i} className="p-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-4">
                <HabitCheck id={h.id} done={st.done.has(t)} scheduled={scheduled} color={h.color} />
                <div className="min-w-0 flex-1 basis-40"><h2 className="truncate text-[16px] font-semibold">{h.name}</h2>
                  <p className="text-xs text-mute">{h.days.length === 7 ? "Every day" : [...h.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAYS.find((x) => x[0] === String(d))![1]).join(", ")}</p></div>
                <div className="flex gap-6">{stat(<span className="inline-flex items-center gap-1"><Icon name="flame" size={16} className={st.streak ? "text-warn" : "text-dim"} />{st.streak}</span>, "streak")}{stat(st.best, "best")}{stat(`${st.rate30}%`, "30 days")}</div>
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t px-4 py-3"><WeekDots id={h.id} today={t} done={[...st.done]} days={h.days} color={h.color} />
                <div className="hidden sm:block"><Heatmap cells={cells} color={rgb} label={(c) => `${c.date}: ${c.count ? "done" : "—"}`} /></div></div>
              <form action={archiveHabitAction.bind(null, h.id)} className="border-t px-4 py-2 text-right"><button className="text-xs text-mute hover:text-danger">Archive habit</button></form>
            </Panel>
          );
        })}
        {!habits.length && <div className="rounded-xl border border-dashed px-6 py-10 text-center"><span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent"><Icon name="habits" size={24} /></span><p className="font-medium">No habits yet</p><p className="mt-1 text-sm text-mute">Start with one. Reading, a walk, water, stretching.</p></div>}
        <Panel title="New habit" i={habits.length + 1}>
          <form action={addHabit} className="space-y-3 px-4 pb-4">
            <div className="flex gap-2"><input name="name" required placeholder="e.g. Read 20 pages" className="field" /><input type="color" name="color" defaultValue="#1877f2" aria-label="Colour" className="h-9 w-11 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5" /></div>
            <fieldset className="flex flex-wrap gap-1.5"><legend className="mb-1.5 text-xs text-mute">Days (leave all unticked for every day)</legend>
              {DAYS.map(([v, l]) => <label key={v} className="cursor-pointer"><input type="checkbox" name="days" value={v} className="peer sr-only" /><span className="inline-flex h-8 items-center rounded-full border px-3 text-[13px] text-mute transition peer-checked:border-accent/40 peer-checked:bg-accent/10 peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50">{l}</span></label>)}</fieldset>
            <button className="btn-primary">Add habit</button>
          </form>
        </Panel>
      </div>
    </FeatureGate>
  );
}
