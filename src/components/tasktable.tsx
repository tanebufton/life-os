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
export function TaskTable({ rows, sort, dir, base, hideProject = false, fields = [], values = {} }: { rows: TaskRow[]; sort: string; dir: string; base: (o: Record<string, string>) => string; hideProject?: boolean; fields?: { id: number; name: string; type: string }[]; values?: Record<number, Record<number, string>> }) {
  const cols = hideProject ? COLS.filter((c) => c.key !== "project") : COLS;
  const col = COLS.find((c) => c.key === sort) ?? COLS[4], sign = dir === "desc" ? -1 : 1;
  const sorted = [...rows].sort((a, b) => { const x = col.get(a), y = col.get(b); return (x < y ? -1 : x > y ? 1 : 0) * sign || a.id - b.id; });
  return (
    <>
    <div className="md:hidden">
      <div className="mb-2 flex gap-1.5 overflow-x-auto text-[12px]">{[["due", "Due"], ["priority", "Priority"], ["created", "Added"], ["title", "Name"]].map(([k, l]) => <Link key={k} href={base({ sort: k, dir: k === col.key && sign === 1 ? "desc" : "asc" })} className={`shrink-0 rounded-full border px-2.5 py-1 ${k === col.key ? "border-accent/40 bg-accent/10 text-accent" : "text-mute"}`}>{l}{k === col.key ? (sign === 1 ? " ↑" : " ↓") : ""}</Link>)}</div>
      <ul className="card divide-y">{sorted.map((t) => (
        <li key={t.id} className="px-3 py-2.5">
          <Link href={`/tasks/${t.id}`} className={`flex items-center gap-2 text-[14px] ${t.done_at ? "text-dim line-through" : ""}`}><StatusIcon status={t.status_kind} size={14} /><span className="min-w-0 flex-1">{t.title}</span></Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[22px] text-xs text-mute">
            {!hideProject && t.project_name && <span>{t.project_name}</span>}<span>{t.status_name}</span>{t.due && <span>{nice(t.due)}</span>}{t.estimate ? <span>{t.estimate}m</span> : null}{t.priority > 0 && <span className="text-danger">High</span>}{t.priority < 0 && <span>Low</span>}
            {t.tags.map((g) => <Pill key={g} name={g} />)}{fields.map((f) => { const v = values[t.id]?.[f.id]; return v ? <span key={`f${f.id}`}>{f.name}: {f.type === "checkbox" ? "Yes" : v}</span> : null; })}</div>
        </li>))}{!sorted.length && <li className="px-3 py-10 text-center text-mute">No tasks.</li>}</ul>
    </div>
    <div className="card hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead><tr className="border-b bg-raise/50 text-xs text-mute">{cols.map((c) => <th key={c.key} scope="col" aria-sort={c.key === col.key ? (sign === 1 ? "ascending" : "descending") : "none"} className="px-3 py-2 font-medium"><Link href={base({ sort: c.key, dir: c.key === col.key && sign === 1 ? "desc" : "asc" })} className="inline-flex items-center gap-1 hover:text-fg">{c.label}{c.key === col.key && <span aria-hidden>{sign === 1 ? "↑" : "↓"}</span>}</Link></th>)}<th scope="col" className="px-3 py-2 font-medium">Tags</th>{fields.map((f) => <th key={`f${f.id}`} scope="col" className="px-3 py-2 font-medium">{f.name}</th>)}</tr></thead>
        <tbody>{sorted.map((t) => (
          <tr key={t.id} className="border-b last:border-b-0 hover:bg-raise/40">
            <td className="max-w-[22rem] px-3 py-2"><Link href={`/tasks/${t.id}`} className={`flex items-center gap-2 hover:underline ${t.done_at ? "text-dim line-through" : ""}`}><StatusIcon status={t.status_kind} size={14} /><span className="truncate">{t.title}</span></Link></td>
            {!hideProject && <td className="px-3 py-2 text-mute">{t.project_name ?? ""}</td>}<td className="whitespace-nowrap px-3 py-2 text-mute">{t.status_name}</td>
            <td className={`px-3 py-2 ${t.priority > 0 ? "text-danger" : "text-mute"}`}>{t.priority > 0 ? "High" : t.priority < 0 ? "Low" : ""}</td>
            <td className="whitespace-nowrap px-3 py-2 text-mute">{t.due ? nice(t.due) : ""}</td><td className="px-3 py-2 text-mute">{t.estimate ? `${t.estimate}m` : ""}</td><td className="px-3 py-2 tabular-nums text-dim">#{t.id}</td>
            <td className="px-3 py-2"><span className="flex flex-wrap gap-1">{t.tags.map((g) => <Pill key={g} name={g} />)}</span></td>
            {fields.map((f) => { const v = values[t.id]?.[f.id] ?? ""; return <td key={`f${f.id}`} className="px-3 py-2 text-mute">{f.type === "checkbox" ? (v ? "Yes" : "") : f.type === "url" && v ? <a href={v} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">link</a> : v}</td>; })}
          </tr>))}
          {!sorted.length && <tr><td colSpan={cols.length + fields.length} className="px-3 py-10 text-center text-mute">No tasks.</td></tr>}</tbody>
      </table>
    </div>
    </>
  );
}
