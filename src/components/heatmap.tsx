import { weekday } from "@/lib/dates";

/** GitHub-style grid. `cells` oldest→newest, one per day. Weeks start Monday. */
export function Heatmap({ cells, color = "var(--accent)", label = (c: { date: string; count: number }) => `${c.date}: ${c.count}` }: { cells: { date: string; count: number }[]; color?: string; label?: (c: { date: string; count: number }) => string }) {
  if (!cells.length) return null;
  const lead = (weekday(cells[0].date) + 6) % 7;
  const padded: ({ date: string; count: number } | null)[] = [...Array(lead).fill(null), ...cells];
  const weeks = Math.ceil(padded.length / 7), max = Math.max(1, ...cells.map((c) => c.count));
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const bg = ["rgb(var(--fg) / 0.07)", `rgb(${color} / 0.3)`, `rgb(${color} / 0.5)`, `rgb(${color} / 0.75)`, `rgb(${color})`];
  const fmtM = new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", month: "short" });
  const all: { w: number; m: string }[] = [];
  cells.forEach((c, i) => { if (i === 0 || c.date.endsWith("-01")) all.push({ w: Math.floor((i + lead) / 7), m: fmtM.format(new Date(c.date + "T00:00:00Z")) }); });
  const months = all.filter((x, k) => k === all.length - 1 || all[k + 1].w - x.w >= 3); // drop a label that would collide with the next
  return (
    <div className="overflow-x-auto pb-1">
      <div className="relative mb-1 h-4 text-[11px] text-dim" style={{ width: weeks * 14 }}>{months.map((m) => <span key={m.w + m.m} className="absolute" style={{ left: m.w * 14 }}>{m.m}</span>)}</div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, 11px)`, gridAutoColumns: "11px", gridTemplateRows: "repeat(7, 11px)" }}>
        {padded.map((c, i) => c ? <span key={c.date} title={label(c)} className="rounded-[3px]" style={{ background: bg[level(c.count)] }} /> : <span key={"p" + i} />)}
      </div>
    </div>
  );
}
