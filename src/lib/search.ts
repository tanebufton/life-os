import { db } from "./db";
import { isOn } from "./features";
import { searchTasks, type TaskRow } from "./tasks";

export type Kind = "task" | "note" | "goal" | "memo" | "project";
export type Hit = { kind: Kind; id: number; title: string; snippet?: string; href: string; meta?: string };
export type Group = { kind: Kind; label: string; items: Hit[] };
const LABEL: Record<Kind, string> = { task: "Tasks", note: "Notes", goal: "Goals", memo: "Voice memos", project: "Projects" };
const esc = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);
const OPERATOR = /^(#|@|!|is:|due:|has:|no:|source:|priority:|status:)/i;
/** Plain words search everything; any task filter (#tag, @project, due:…) narrows the search to tasks. */
export const hasOperators = (q: string) => q.trim().split(/\s+/).some((t) => OPERATOR.test(t));
const plain = (s: string) => s.replace(/```[\s\S]*?```/g, " ").replace(/[#>*`_~|-]|\[\[|\]\]/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
/** A short excerpt around the first match. */
export function snippet(text: string, terms: string[], len = 140): string {
  const t = plain(text); if (!t) return ""; const low = t.toLowerCase(); let at = -1;
  for (const w of terms) { const i = low.indexOf(w.toLowerCase()); if (i >= 0 && (at < 0 || i < at)) at = i; }
  const start = at < 0 ? 0 : Math.max(0, at - 50), out = t.slice(start, start + len);
  return (start > 0 ? "…" : "") + out + (start + len < t.length ? "…" : "");
}
/** WHERE fragment matching every term in at least one of the columns. */
const where = (cols: string[], terms: string[]) => ({ sql: terms.map(() => `(${cols.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(" OR ")})`).join(" AND "), args: terms.flatMap((w) => cols.map(() => `%${esc(w)}%`)) });
const rank = (title: string, terms: string[]) => terms.every((w) => title.toLowerCase().includes(w.toLowerCase())) ? 0 : 1;

export function searchAll(q: string, o: { limit?: number; kinds?: Kind[] } = {}): { query: string; groups: Group[] } {
  const query = q.trim(), limit = o.limit ?? 8, want = (k: Kind) => !o.kinds || o.kinds.includes(k), groups: Group[] = [];
  if (!query) return { query, groups };
  const terms = query.split(/\s+/).filter(Boolean);
  const tasks = want("task") ? searchTasks(query, limit) : [];
  if (tasks.length) groups.push({ kind: "task", label: LABEL.task, items: tasks.map((t: TaskRow) => ({ kind: "task", id: t.id, title: t.title, snippet: t.notes ? snippet(t.notes, terms, 100) : undefined, href: `/tasks/${t.id}`, meta: [t.project_name, t.due].filter(Boolean).join(" · ") || undefined })) });
  if (hasOperators(query)) return { query, groups };
  const add = (kind: Kind, items: Hit[]) => { if (items.length) groups.push({ kind, label: LABEL[kind], items: items.sort((a, b) => rank(a.title, terms) - rank(b.title, terms)).slice(0, limit) }); };
  if (want("note") && isOn("notes")) { const w = where(["title", "body"], terms); add("note", (db.prepare(`SELECT id, title, body, updated_at FROM notes WHERE deleted_at IS NULL AND ${w.sql} ORDER BY pinned DESC, updated_at DESC LIMIT ?`).all(...w.args, limit * 2) as { id: number; title: string; body: string; updated_at: string }[]).map((n) => ({ kind: "note", id: n.id, title: n.title || "Untitled", snippet: snippet(n.body, terms), href: `/notes/${n.id}`, meta: n.updated_at.slice(0, 10) }))); }
  if (want("goal") && isOn("goals")) { const w = where(["title", "description"], terms); add("goal", (db.prepare(`SELECT id, title, description, area FROM goals WHERE status!='archived' AND ${w.sql} LIMIT ?`).all(...w.args, limit * 2) as { id: number; title: string; description: string; area: string }[]).map((g) => ({ kind: "goal", id: g.id, title: g.title, snippet: g.description ? snippet(g.description, terms) : undefined, href: "/goals", meta: g.area }))); }
  if (want("memo") && isOn("voice")) { const w = where(["text"], terms); add("memo", (db.prepare(`SELECT id, text, created_at FROM voice_memos WHERE deleted_at IS NULL AND ${w.sql} ORDER BY id DESC LIMIT ?`).all(...w.args, limit * 2) as { id: number; text: string; created_at: string }[]).map((m) => ({ kind: "memo", id: m.id, title: plain(m.text).slice(0, 80), href: "/voice", meta: m.created_at.slice(0, 10) }))); }
  if (want("project")) { const w = where(["name"], terms); add("project", (db.prepare(`SELECT id, name FROM projects WHERE archived=0 AND ${w.sql} LIMIT ?`).all(...w.args, limit) as { id: number; name: string }[]).map((p) => ({ kind: "project", id: p.id, title: p.name, href: `/projects/${p.id}` }))); }
  return { query, groups };
}
