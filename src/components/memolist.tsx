import Link from "next/link";
import { Icon } from "./Icon";
import { convertMemoAction, deleteMemoAction } from "@/lib/actions3";
import type { Memo } from "@/lib/voice";

const day = (iso: string, today: string, yesterday: string) => { const d = iso.slice(0, 10); return d === today ? "Today" : d === yesterday ? "Yesterday" : new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(d + "T00:00:00Z")); };
const quiet = "rounded px-1.5 py-0.5 text-mute hover:bg-raise hover:text-fg";

/** Memos grouped by day. Each one shows what it became, and offers the other things it could become. */
export function MemoList({ memos, projects }: { memos: Memo[]; projects?: Map<number, string> }) {
  const now = new Date(), today = now.toISOString().slice(0, 10), yesterday = new Date(now.getTime() - 864e5).toISOString().slice(0, 10), groups: { label: string; items: Memo[] }[] = [];
  for (const m of memos) { const l = day(m.created_at, today, yesterday), g = groups[groups.length - 1]; if (g && g.label === l) g.items.push(m); else groups.push({ label: l, items: [m] }); }
  if (!memos.length) return <p className="py-12 text-center text-sm text-mute">No memos yet. Hold the button above and say something.</p>;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="mb-1.5 px-1 text-xs font-semibold text-dim">{g.label}</h3>
          <ul className="divide-y rounded-xl border bg-panel">
            {g.items.map((m) => (
              <li key={m.id} className="group px-4 py-3">
                <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{m.text}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
                  <span className="mr-1 text-dim">{m.created_at.slice(11, 16)}{m.source !== "web" ? ` · ${m.source}` : ""}{m.project_id && projects?.get(m.project_id) ? ` · ${projects.get(m.project_id)}` : ""}</span>
                  {m.task_id ? <Link href={`/tasks/${m.task_id}`} className="inline-flex items-center gap-1 rounded bg-ok/10 px-1.5 py-0.5 text-ok hover:underline"><Icon name="today" size={12} />Task</Link> : <form action={convertMemoAction.bind(null, m.id, "task")}><button className={quiet}>Make task</button></form>}
                  {m.note_id ? <Link href={`/notes/${m.note_id}`} className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-accent hover:underline"><Icon name="notes" size={12} />Note</Link> : <form action={convertMemoAction.bind(null, m.id, "note")}><button className={quiet}>Make note</button></form>}
                  <form action={deleteMemoAction.bind(null, m.id)} className="ml-auto"><button aria-label="Delete memo" className="rounded p-1 text-dim opacity-0 hover:bg-raise hover:text-danger focus:opacity-100 group-hover:opacity-100"><Icon name="trash" size={14} /></button></form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
