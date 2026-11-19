"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { previewImportAction, runImportAction, type ImportSummary } from "@/lib/actions5";

type F = { name: string; text: string };
/** Pick files, see what would be imported, then confirm. Nothing changes until you press Import. */
export function ImportPanel() {
  const [files, setFiles] = useState<F[]>([]), [project, setProject] = useState(""), [sum, setSum] = useState<ImportSummary | null>(null), [err, setErr] = useState(""), [done, setDone] = useState(""), [busy, start] = useTransition(), input = useRef<HTMLInputElement>(null);
  const read = async (list: FileList | null) => {
    setSum(null); setErr(""); setDone(""); if (!list?.length) return;
    const fs = await Promise.all([...list].slice(0, 300).map(async (f) => ({ name: f.name, text: await f.text() }))); setFiles(fs);
    start(async () => { const r = await previewImportAction(fs, project); if (r.ok) setSum(r.summary); else setErr(r.error); });
  };
  const again = () => { if (!files.length) return; start(async () => { const r = await previewImportAction(files, project); if (r.ok) setSum(r.summary); else setErr(r.error); }); };
  const go = () => start(async () => { const r = await runImportAction(files, project); if (!r.ok) { setErr(r.error); return; } const x = r.result; setDone(`Imported ${x.tasks} task${x.tasks === 1 ? "" : "s"}${x.subtasks ? ` (+${x.subtasks} subtasks)` : ""}${x.notes ? `, ${x.notes} note${x.notes === 1 ? "" : "s"}` : ""}${x.skipped ? `. Skipped ${x.skipped} that were already here` : ""}.`); toast("Import finished"); setSum(null); setFiles([]); if (input.current) input.current.value = ""; });
  const nothing = sum && sum.tasks + sum.subtasks + sum.notes === 0;
  return (
    <div className="space-y-3 p-4">
      <p className="text-[13px] text-mute">Bring in tasks from <b>Todoist</b> (CSV export), any <b>CSV</b> with a title column (Notion databases, spreadsheets), and <b>Markdown or text files</b> as notes (Notion exports). Unzip archives first. Anything already here is skipped, so it&apos;s safe to run twice.</p>
      <div className="flex flex-wrap items-center gap-2"><input ref={input} type="file" multiple accept=".csv,.md,.markdown,.txt" aria-label="Files to import" onChange={(e) => void read(e.target.files)} className="text-[13px]" />
        <input value={project} onChange={(e) => setProject(e.target.value)} onBlur={again} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} placeholder="Project (optional)" aria-label="Project for imported tasks" className="field !w-48" /></div>
      {busy && !sum && <p className="text-[13px] text-mute">Reading…</p>}
      {err && <p className="text-[13px] text-danger" role="alert">{err}</p>}
      {sum && (
        <div className="space-y-2 rounded-lg border bg-raise/40 p-3 text-[13px]">
          <div><b>{sum.formats.join(" + ") || "Nothing recognised"}</b>: {sum.tasks} task{sum.tasks === 1 ? "" : "s"}{sum.subtasks ? ` + ${sum.subtasks} subtasks` : ""}{sum.done ? ` (${sum.done} already done)` : ""}, {sum.notes} note{sum.notes === 1 ? "" : "s"}</div>
          {sum.sample.length > 0 && <ul className="list-disc pl-5 text-mute">{sum.sample.map((t, i) => <li key={i}>{t.title}{t.project ? <span className="text-dim"> · {t.project}</span> : null}{t.due ? <span className="text-dim"> · {t.due}</span> : null}</li>)}{sum.tasks + sum.subtasks > sum.sample.length && <li className="list-none text-dim">…and more</li>}</ul>}
          {sum.noteTitles.length > 0 && <div className="text-mute">Notes: {sum.noteTitles.join(", ")}</div>}
          {sum.warnings.map((w, i) => <div key={i} className="text-warn">{w}</div>)}
          <button className="btn-primary" disabled={busy || !!nothing} onClick={go}>{busy ? "Importing…" : "Import"}</button>
        </div>)}
      {done && <p className="text-[13px] text-ok" role="status">{done}</p>}
    </div>
  );
}
