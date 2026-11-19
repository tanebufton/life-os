import Link from "next/link";
import { FeatureGate } from "@/components/FeatureGate";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { VoiceRecorder } from "@/components/voice";
import { convertMemoAction, deleteMemoAction } from "@/lib/actions3";
import { listMemos } from "@/lib/voice";

export const dynamic = "force-dynamic";
export default function Voice() {
  const memos = listMemos(60);
  return (
    <FeatureGate feature="voice">
      <div className="max-w-4xl">
        <PageHead title="Voice memos" sub="Say it, and it becomes text, a task or a note" />
        <Panel title="Record" i={0}><VoiceRecorder /></Panel>
        <Panel title="Recent" count={memos.length} i={1} className="mt-4">
          <ul>{memos.map((m) => (
            <li key={m.id} className="border-b px-4 py-3 last:border-b-0">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{m.text}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
                <span>{m.created_at.slice(0, 16).replace("T", " ")}</span><span className="lozenge bg-raise">{m.source}</span>
                {m.task_id ? <Link href={`/tasks/${m.task_id}`} className="text-accent hover:underline">Task #{m.task_id}</Link> : <form action={convertMemoAction.bind(null, m.id, "task")}><button className="hover:text-fg">Make task</button></form>}
                {m.note_id ? <Link href={`/notes/${m.note_id}`} className="text-accent hover:underline">Note</Link> : <form action={convertMemoAction.bind(null, m.id, "note")}><button className="hover:text-fg">Make note</button></form>}
                <form action={deleteMemoAction.bind(null, m.id)} className="ml-auto"><button className="text-dim hover:text-danger">Delete</button></form>
              </div>
            </li>))}
            {!memos.length && <li className="px-4 py-10 text-center text-sm text-mute">No memos yet. Record one above, or install the Chrome extension to send them from anywhere.</li>}</ul>
        </Panel>
      </div>
    </FeatureGate>
  );
}
