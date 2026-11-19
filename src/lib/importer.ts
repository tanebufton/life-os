// Bring in tasks and notes from other tools. Parsing is separate from importing so people can preview first.
// Formats: Todoist CSV export, any CSV with a title column (Notion databases, spreadsheets), and Markdown/text files (one note each).
import { runAs } from "./activity";
import { parseCsv } from "./csv";
import { db } from "./db";
import { createNote } from "./notes";
import { setEntityTags } from "./entitytags";
import { cleanTag, completeTask, createTask, parseQuickAdd, projectByName } from "./tasks";
import { today } from "./time";

export type ImportFile = { name: string; text: string };
export type ImportTask = { title: string; notes: string; project: string | null; due: string | null; due_time: string | null; repeat: string | null; priority: number; tags: string[]; done: boolean; estimate: number | null; parent: number | null };
export type ImportNote = { title: string; body: string; tags: string[] };
export type Preview = { formats: string[]; tasks: ImportTask[]; notes: ImportNote[]; warnings: string[] };
export const LIMITS = { files: 300, bytes: 5_000_000, tasks: 5000 };

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, " ");
const pick = (hdr: string[], ...names: string[]) => { for (const n of names) { const i = hdr.indexOf(n); if (i >= 0) return i; } return -1; };
/** Todoist writes dates as words ("tomorrow", "every mon", "Nov 20"), so reuse the quick-add date reader on them. */
function readDate(raw: string): { due: string | null; time: string | null; repeat: string | null } {
  const s = raw.trim(); if (!s) return { due: null, time: null, repeat: null };
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}))?/); if (iso) return { due: `${iso[1]}-${iso[2]}-${iso[3]}`, time: iso[4] ?? null, repeat: null };
  const nz = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/); if (nz) return { due: `${nz[3]}-${nz[2].padStart(2, "0")}-${nz[1].padStart(2, "0")}`, time: null, repeat: null }; // day first, as in NZ
  try { const p = parseQuickAdd(`x ${s}`); return { due: p.due ?? null, time: p.due_time ?? null, repeat: p.repeat ?? null }; } catch { return { due: null, time: null, repeat: null }; }
}
const truthy = (v: string) => /^(true|yes|y|1|done|complete|completed|checked|✓|x)$/i.test(v.trim());
const tagsOf = (v: string) => [...new Set(v.split(/[;,|]|\s{2,}/).flatMap((x) => x.trim().split(/\s+/)).map(cleanTag).filter(Boolean))];

function fromCsv(f: ImportFile, project: string, out: Preview) {
  const rows = parseCsv(f.text).filter((r) => r.some((c) => c.trim())); if (rows.length < 2) { out.warnings.push(`${f.name}: no rows found`); return; }
  const hdr = rows[0].map(norm), body = rows.slice(1);
  // ---- Todoist: TYPE, CONTENT, DESCRIPTION, PRIORITY, INDENT, ..., DATE
  if (hdr.includes("type") && hdr.includes("content")) {
    const ti = hdr.indexOf("type"), ci = hdr.indexOf("content"), di = pick(hdr, "description"), pi = pick(hdr, "priority"), ii = pick(hdr, "indent"), dti = pick(hdr, "date");
    const proj = project || f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || null; let sections = 0, last = -1; const stack: { indent: number; idx: number }[] = [];
    for (const r of body) {
      const type = (r[ti] ?? "").trim().toLowerCase(), content = (r[ci] ?? "").trim();
      if (type === "section") { sections++; continue; }
      if (type === "note") { if (last >= 0 && content) out.tasks[last].notes += (out.tasks[last].notes ? "\n\n" : "") + content; continue; }
      if (type !== "task" || !content) continue;
      const indent = Math.max(1, Number(r[ii]) || 1); while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const d = readDate(r[dti] ?? ""), pr = Number(r[pi]); // Todoist numbers priority 1 (highest) to 4
      out.tasks.push({ title: content, notes: (r[di] ?? "").trim(), project: proj, due: d.due, due_time: d.time, repeat: d.repeat, priority: pr === 1 ? 1 : 0, tags: [], done: false, estimate: null, parent: stack.length ? stack[stack.length - 1].idx : null });
      last = out.tasks.length - 1; stack.push({ indent, idx: last });
    }
    if (sections) out.warnings.push(`${f.name}: ${sections} Todoist section${sections === 1 ? "" : "s"} not imported (tasks are kept)`);
    out.formats.push("Todoist CSV"); return;
  }
  // ---- generic: any CSV with a title-ish column
  const ti = pick(hdr, "title", "name", "task", "content", "summary", "item"); if (ti < 0) { out.warnings.push(`${f.name}: couldn't find a title column (looked for title, name, task, content)`); return; }
  const ni = pick(hdr, "notes", "note", "description", "details", "body"), di = pick(hdr, "due", "due date", "date", "deadline", "when"), pi = pick(hdr, "priority"), gi = pick(hdr, "tags", "tag", "labels", "label", "categories"), pji = pick(hdr, "project", "list"), si = pick(hdr, "status", "state", "done", "completed", "complete"), ei = pick(hdr, "estimate", "estimate min", "estimate minutes", "minutes");
  for (const r of body) {
    const title = (r[ti] ?? "").trim(); if (!title) continue; const d = readDate(r[di] ?? ""), pr = (r[pi] ?? "").trim().toLowerCase(), st = (r[si] ?? "").trim();
    out.tasks.push({ title, notes: (r[ni] ?? "").trim(), project: (r[pji] ?? "").trim() || project || null, due: d.due, due_time: d.time, repeat: d.repeat, priority: /^(high|urgent|1|p1|!+)$/.test(pr) ? 1 : /^(low|-1)$/.test(pr) ? -1 : 0, tags: tagsOf(r[gi] ?? ""), done: si >= 0 && truthy(st), estimate: Number(r[ei]) > 0 ? Math.round(Number(r[ei])) : null, parent: null });
  }
  out.formats.push("CSV");
}
function fromText(f: ImportFile, out: Preview) {
  const lines = f.text.replace(/\r/g, "").split("\n"); let title = "", start = 0;
  const h = lines.findIndex((l) => l.trim()); if (h >= 0 && /^#\s+/.test(lines[h])) { title = lines[h].replace(/^#\s+/, "").trim(); start = h + 1; }
  const meta: string[] = []; // Notion exports put "Tags: a, b" style lines straight under the title
  let tags: string[] = []; while (start < lines.length && /^(tags?|created|last edited|status|property)\s*:/i.test(lines[start])) { const m = lines[start].match(/^tags?\s*:\s*(.*)$/i); if (m) tags = tagsOf(m[1]); else meta.push(lines[start]); start++; }
  const body = lines.slice(start).join("\n").trim();
  out.notes.push({ title: title || f.name.replace(/\.[^.]+$/, "").replace(/\s[0-9a-f]{32}$/i, "").trim() || "Imported note", body: body || meta.join("\n"), tags });
  if (!out.formats.includes("Markdown")) out.formats.push("Markdown");
}
export function parseImport(files: ImportFile[], o: { project?: string } = {}): Preview {
  const out: Preview = { formats: [], tasks: [], notes: [], warnings: [] }, project = (o.project ?? "").trim();
  if (files.length > LIMITS.files) out.warnings.push(`Only the first ${LIMITS.files} files were read`);
  let bytes = 0;
  for (const f of files.slice(0, LIMITS.files)) {
    bytes += f.text.length; if (bytes > LIMITS.bytes) { out.warnings.push("Stopped reading: that's more than 5 MB. Import in smaller batches."); break; }
    if (/\.zip$/i.test(f.name)) { out.warnings.push(`${f.name}: unzip it first and pick the files inside`); continue; }
    if (/\.(csv)$/i.test(f.name) || (/^[^#\n]*,/.test(f.text.split("\n")[0] ?? "") && !/\.(md|markdown|txt)$/i.test(f.name))) fromCsv(f, project, out);
    else if (/\.(md|markdown|txt)$/i.test(f.name)) fromText(f, out);
    else out.warnings.push(`${f.name}: not a CSV, Markdown or text file`);
  }
  if (out.tasks.length > LIMITS.tasks) { out.warnings.push(`Only the first ${LIMITS.tasks} tasks will be imported`); out.tasks.length = LIMITS.tasks; }
  return out;
}
export type ImportResult = { tasks: number; subtasks: number; notes: number; skipped: number; completed: number };
/** Create everything in the preview, skipping what's already here (same title and project, and same date when the import has one; same note title). Safe to run twice. */
export function runImport(p: Preview): ImportResult {
  const res: ImportResult = { tasks: 0, subtasks: 0, notes: 0, skipped: 0, completed: 0 };
  return runAs("import", () => db.transaction(() => {
    const has = db.prepare("SELECT 1 FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE lower(t.title)=lower(?) AND (? IS NULL OR t.due=?) AND lower(COALESCE(p.name,''))=lower(?) AND t.deleted_at IS NULL LIMIT 1");
    const ids: (number | null)[] = [];
    for (const t of p.tasks) {
      if (has.get(t.title, t.due, t.due, t.project ?? "")) { res.skipped++; ids.push(null); continue; }
      if (t.project && projectByName(t.project) === null) db.prepare("INSERT INTO projects (name) VALUES (?)").run(t.project.slice(0, 60));
      const parent = t.parent !== null ? ids[t.parent] : null;
      const id = createTask({ title: t.title.slice(0, 500), notes: t.notes.slice(0, 50_000), project: t.project ?? undefined, due: t.due ?? undefined, due_time: t.due_time ?? undefined, repeat: t.repeat ?? undefined, priority: t.priority, tags: t.tags, estimate: t.estimate ?? undefined, parent_id: parent ?? undefined, source: "import" });
      ids.push(id); if (parent) res.subtasks++; else res.tasks++; if (t.done) { completeTask(id); res.completed++; }
    }
    const haveNote = db.prepare("SELECT 1 FROM notes WHERE lower(title)=lower(?) AND deleted_at IS NULL LIMIT 1");
    for (const n of p.notes) {
      if (haveNote.get(n.title)) { res.skipped++; continue; }
      const id = createNote(n.title.slice(0, 200), n.body.slice(0, 200_000)); if (n.tags.length) setEntityTags("note", id, n.tags); res.notes++;
    }
    return res;
  })());
}
