import { ReorderList } from "./reorder";
import { byPosition } from "@/lib/tasks";
import Link from "next/link";
import type { ReactNode } from "react";
import { diffDays, fmtMinutes, fmtTime, nice } from "@/lib/dates";
import { isOn } from "@/lib/features";
import { describeRepeat, type TaskRow } from "@/lib/tasks";
import { today } from "@/lib/time";
import { firstUrl, hostOf } from "@/lib/ui";
import { CheckButton } from "./check";
import { Icon } from "./Icon";
import { Pill } from "./Pill";
import { RowActions } from "./rowactions";

export function PageHead({ title, sub, icon, right }: { title: string; sub?: ReactNode; icon?: ReactNode; right?: ReactNode }) {
  return (
    <div className="rise mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">{icon}<div className="min-w-0"><h1 className="truncate text-[28px] font-bold leading-tight tracking-tight md:text-[32px]">{title}</h1>{sub && <p className="mt-0.5 text-[14px] text-mute">{sub}</p>}</div></div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function dueInfo(due: string, done: boolean): { text: string; cls: string } {
  const d = diffDays(due, today());
  const [wd, md] = nice(due).split(", ");
  if (done) return { text: md, cls: "text-dim" };
  if (d < 0) return { text: d === -1 ? "Yesterday" : md, cls: "text-danger" };
  if (d === 0) return { text: "Today", cls: "text-ok" };
  if (d === 1) return { text: "Tomorrow", cls: "text-warn" };
  return { text: d < 7 ? wd : md, cls: "text-mute" };
}

export function TaskRow({ t }: { t: TaskRow }) {
  const done = !!t.done_at;
  const due = t.due ? dueInfo(t.due, done) : null;
  const url = firstUrl(t.title, t.notes);
  const from = t.source === "email" && t.meta ? (JSON.parse(t.meta).from as string | undefined)?.replace(/<.*>/, "").trim() : null;
  const ring = t.priority > 0 ? "border-danger bg-danger/10 hover:bg-danger/20" : t.priority < 0 ? "border-accent/70 hover:bg-accent/10" : "border-fg/35 hover:bg-fg/5";
  return (
    <li data-task-id={t.id} className="group relative flex items-start gap-3 border-b px-2 py-2.5 transition-colors last:border-b-0 hover:bg-raise/60">
      <div className="flex pt-px"><CheckButton id={t.id} done={done} ring={ring} /></div>
      <div className="min-w-0 flex-1">
        <Link href={`/tasks/${t.id}`} className={`block truncate text-[14.5px] leading-[18px] ${done ? "text-dim line-through" : ""}`}>{t.title}</Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {due && <span className={`inline-flex items-center gap-1 ${due.cls}`}><Icon name="calendar" size={12} />{due.text}{t.due_time && <span className="text-mute">· {fmtTime(t.due_time)}</span>}</span>}
          {t.estimate ? <span className="inline-flex items-center gap-1 text-mute" title="Estimate"><Icon name="clock" size={12} />{fmtMinutes(t.estimate)}</span> : null}
          {t.repeat && <span className="inline-flex items-center gap-1 text-mute" title="Repeats"><Icon name="repeat" size={12} />{describeRepeat(t.repeat)}</span>}
          {t.sub_total > 0 && <span className="inline-flex items-center gap-1 text-mute" title="Subtasks"><Icon name="list" size={12} />{t.sub_done}/{t.sub_total}</span>}
          {t.status_kind === "doing" && !done && <span className="lozenge bg-accent/15 text-accent">{t.status_name}</span>}
          {from !== null && from !== undefined && <span className="inline-flex items-center gap-1 text-mute" title="Imported from email"><Icon name="mail" size={12} />{from || "Email"}</span>}
          {t.source === "share" && <span className="inline-flex items-center gap-1 text-mute"><Icon name="share" size={12} />Shared</span>}
          {url && <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-accent hover:underline" title={url}><Icon name="link" size={12} />{hostOf(url)}</a>}
          {t.tags.filter((g) => !(g === "email" && from !== null && from !== undefined)).map((g) => <Pill key={g} name={g} href={`/tasks?tag=${encodeURIComponent(g)}`} />)}
        </div>
      </div>
      {t.project_name && <span className="mt-px hidden shrink-0 items-center gap-1.5 text-xs text-mute sm:inline-flex"><span className="h-2 w-2 rounded-[3px]" style={{ background: t.project_color ?? "#888" }} />{t.project_name}</span>}
      {!done && <RowActions id={t.id} due={t.due} focus={isOn("focus")} />}
    </li>
  );
}

export type Group = { label: string; tone?: "danger" | "warn" | "accent" | "ok"; tasks: TaskRow[] };
const TONE = { danger: "text-danger", warn: "text-warn", accent: "text-accent", ok: "text-ok", none: "" };
export function TaskGroups({ groups, empty }: { groups: Group[]; empty: ReactNode }) {
  const shown = groups.filter((g) => g.tasks.length);
  if (!shown.length) return (
    <div className="flex flex-col items-center gap-2 py-14 text-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-ok/10 text-ok"><Icon name="circleCheck" size={28} /></span><p className="max-w-xs text-[14px] text-mute">{empty}</p></div>
  );
  return (
    <div>
      {shown.map((g) => (
        <section key={g.label} className="rise">
          {g.label ? <h3 className="flex items-baseline gap-2 border-b px-2 pb-1.5 pt-5 text-[13px] font-semibold first:pt-0"><span className={TONE[g.tone ?? "none"]}>{g.label}</span><span className="font-normal text-dim">{g.tasks.length}</span></h3> : null}
          <ReorderList>{g.tasks.map((t) => <TaskRow key={t.id} t={t} />)}</ReorderList>
        </section>
      ))}
    </div>
  );
}

/** Bucket open tasks by urgency. */
export function bucket(tasks: TaskRow[]): Group[] {
  const t = today();
  const used = new Set<number>();
  const take = (f: (x: TaskRow) => boolean) => byPosition(tasks.filter((x) => !used.has(x.id) && f(x) && used.add(x.id)));
  return [
    { label: "Overdue", tone: "danger", tasks: take((x) => !!x.due && x.due < t) },
    { label: "Today", tone: "ok", tasks: take((x) => x.due === t) },
    { label: "In progress", tone: "accent", tasks: take((x) => x.status_kind === "doing") },
    { label: "Next 7 days", tasks: take((x) => !!x.due && diffDays(x.due, t) <= 7) },
    { label: "Later", tasks: take((x) => !!x.due) },
    { label: "No date", tasks: take(() => true) },
  ];
}
