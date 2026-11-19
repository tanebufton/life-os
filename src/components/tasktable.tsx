import Link from "next/link";
import { nice } from "@/lib/dates";
import { StatusIcon } from "./StatusIcon";
import { Pill } from "./Pill";
import type { TaskRow } from "@/lib/tasks";

const COLS: { key: string; label: string; get: (t: TaskRow) => string | number }[] = [
  { key: "title", label: "Task", get: (t) => t.title.toLowerCase() }, { key: "project", label: "Project", get: (t) => (t.project_name ?? "~").toLowerCase() }, { key: "status", label: "Status", get: (t) => ({ todo: 0, doing: 1, done: 2 })[t.status_kind] },
  { key: "priority", label: "Priority", get: (t) => -t.priority }, { key: "due", label: "Due", get: (t) => t.due ?? "9999" }, { key: "estimate", label: "Estimate", get: (t) => t.estimate ?? 99999 }, { key: "created", label: "Added", get: (t) => t.id },
];
/** A sortable table of tasks. Click a heading to sort by it; click again to reverse. */
export function TaskTable({ rows, sort, dir, base }: { rows: TaskRow[]; sort: string; dir: string; base: (o: Record<string, string>) => string }) {
  const col = COLS.find((c) => c.key === sort) ?? COLS[4], sign = dir === "desc" ? -1 : 1;
  const sorted = [...rows].sort((a, b) => { const x = col.get(a), y = col.get(b); return (x < y ? -1 : x > y ? 1 : 0) * sign || a.id - b.id; });
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead><tr className="border-b bg-raise/50 text-xs text-mute">{COLS.map((c) => <th key={c.key} scope="col" aria-sort={c.key === col.key ? (sign === 1 ? "ascending" : "descending") : "none"} className="px-3 py-2 font-medium"><Link href={base({ sort: c.key, dir: c.key === col.key && sign === 1 ? "desc" : "asc" })} className="inline-flex items-center gap-1 hover:text-fg">{c.label}{c.key === col.key && <span aria-hidden>{sign === 1 ? "↑" : "↓"}</span>}</Link></th>)}<th scope="col" className="px-3 py-2 font-medium">Tags</th></tr></thead>
        <tbody>{sorted.map((t) => (
          <tr key={t.id} className="border-b last:border-b-0 hover:bg-raise/40">
            <td className="max-w-[22rem] px-3 py-2"><Link href={`/tasks/${t.id}`} className={`flex items-center gap-2 hover:underline ${t.done_at ? "text-dim line-through" : ""}`}><StatusIcon status={t.status_kind} size={14} /><span className="truncate">{t.title}</span></Link></td>
            <td className="px-3 py-2 text-mute">{t.project_name ?? ""}</td><td className="px-3 py-2 text-mute">{t.status_name}</td>
            <td className={`px-3 py-2 ${t.priority > 0 ? "text-danger" : "text-mute"}`}>{t.priority > 0 ? "High" : t.priority < 0 ? "Low" : ""}</td>
            <td className="whitespace-nowrap px-3 py-2 text-mute">{t.due ? nice(t.due) : ""}</td><td className="px-3 py-2 text-mute">{t.estimate ? `${t.estimate}m` : ""}</td><td className="px-3 py-2 tabular-nums text-dim">#{t.id}</td>
            <td className="px-3 py-2"><span className="flex flex-wrap gap-1">{t.tags.map((g) => <Pill key={g} name={g} />)}</span></td>
          </tr>))}
          {!sorted.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-mute">No tasks.</td></tr>}</tbody>
      </table>
    </div>
  );
}
