import { AutoPrint } from "@/components/autoprint";
import { db } from "@/lib/db";
import { listMemos } from "@/lib/voice";

export const dynamic = "force-dynamic";
/** A clean, printable list of voice memos. It opens the browser's print dialog: choose "Save as PDF". */
export default function MemosPrint() {
  const memos = listMemos(1000), projects = new Map((db.prepare("SELECT id, name FROM projects").all() as { id: number; name: string }[]).map((p) => [p.id, p.name]));
  return (
    <div className="mx-auto max-w-3xl">
      <AutoPrint />
      <div className="mb-6 flex items-end justify-between border-b pb-3" data-no-print><div><h1 className="text-2xl font-bold">Voice memos</h1><p className="text-sm text-mute">{memos.length} memos. Use your browser&apos;s print dialog and choose “Save as PDF”.</p></div><button className="btn" id="print-btn">Print / Save as PDF</button></div>
      <h1 className="mb-1 hidden text-2xl font-bold print:block">Voice memos</h1>
      <ol className="space-y-4">
        {memos.map((m) => (
          <li key={m.id} className="break-inside-avoid border-b pb-3">
            <div className="mb-1 text-xs text-mute">{m.created_at.slice(0, 16).replace("T", " ")}{m.project_id && projects.get(m.project_id) ? ` · ${projects.get(m.project_id)}` : ""}{m.source !== "web" ? ` · ${m.source}` : ""}</div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.text}</p>
          </li>))}
      </ol>
      {!memos.length && <p className="text-mute">No memos yet.</p>}
    </div>
  );
}
