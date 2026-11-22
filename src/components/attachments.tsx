"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteAttachmentAction } from "@/lib/actions5";
import { Icon } from "./Icon";

type Att = { id: number; name: string; mime: string; size: number };
const size = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
/** Files on a task: drop them, paste a screenshot, or pick them. Images show as thumbnails. */
export function Attachments({ taskId, files }: { taskId: number; files: Att[] }) {
  const router = useRouter(), input = useRef<HTMLInputElement>(null), [busy, setBusy] = useState(false), [over, setOver] = useState(false);
  const upload = async (list: File[]) => {
    if (!list.length) return; setBusy(true);
    const fd = new FormData(); fd.set("task", String(taskId)); list.forEach((f) => fd.append("file", f, f.name));
    try {
      const r = await fetch("/api/attachments", { method: "POST", headers: { "x-lifeos": "1" }, body: fd, credentials: "same-origin" }), j = await r.json().catch(() => ({} as { added?: number; errors?: string[]; error?: string }));
      if (j.added) toast(`Attached ${j.added} file${j.added === 1 ? "" : "s"}`);
      for (const e of j.errors ?? []) toast(e);
      if (!r.ok && !j.added && !(j.errors ?? []).length) toast(j.error ?? "Couldn't attach that");
    } catch { toast("Couldn't upload. Check your connection and try again."); }
    setBusy(false); router.refresh();
  };
  // Pasting a screenshot or file anywhere on the task page attaches it (pasting text still goes to the text box).
  useEffect(() => {
    const p = (e: ClipboardEvent) => { const fs = [...(e.clipboardData?.files ?? [])]; if (fs.length) { e.preventDefault(); void upload(fs.map((f) => (f.name && f.name !== "image.png" ? f : new File([f], `pasted-${Date.now()}.${(f.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, { type: f.type })))); } };
    document.addEventListener("paste", p); return () => document.removeEventListener("paste", p);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const del = async (a: Att) => { const r = await deleteAttachmentAction(a.id); toast(r.ok ? "Removed" : r.error); router.refresh(); };
  return (
    <section aria-label="Attachments" className="mt-6" onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setOver(false); void upload([...e.dataTransfer.files]); } }}>
      <div className="mb-2 flex items-center gap-3"><h3 className="text-[14px] font-semibold">Attachments</h3>{files.length > 0 && <span className="text-xs text-dim">{files.length}</span>}
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex items-center gap-1 text-[13px] text-accent hover:underline"><Icon name="plus" size={13} />{busy ? "Uploading…" : "Add files"}</button>
        <input ref={input} type="file" multiple hidden accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,.docx,.xlsx,.pptx,.odt,.ods,.txt,.md,.csv,.log,.json" onChange={(e) => { void upload([...(e.target.files ?? [])]); e.target.value = ""; }} /></div>
      {files.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{files.map((a) => (
          <li key={a.id} className="group relative overflow-hidden rounded-lg border bg-panel">
            <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer noopener" className="block">
              {a.mime.startsWith("image/") ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/attachments/${a.id}`} alt={a.name} loading="lazy" className="h-28 w-full object-cover" /> : <div className="grid h-28 place-items-center bg-raise/50 text-mute"><Icon name={a.mime === "application/pdf" ? "notes" : "list"} size={28} /></div>}
              <div className="px-2.5 py-1.5"><div className="truncate text-[13px]" title={a.name}>{a.name}</div><div className="text-[11px] text-dim">{size(a.size)}</div></div>
            </a>
            <button type="button" aria-label={`Remove ${a.name}`} onClick={() => void del(a)} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-bg/90 text-mute opacity-0 shadow-sm hover:text-danger focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"><Icon name="x" size={13} /></button>
          </li>))}</ul>
      ) : <div className={`rounded-lg border border-dashed px-3 py-5 text-center text-[13px] ${over ? "border-accent bg-accent/5 text-accent" : "text-mute"}`}>Drop files here, paste a screenshot, or use Add files. Images, PDFs, text and Office documents, up to 10 MB each.</div>}
    </section>
  );
}
