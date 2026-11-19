import { FeatureGate } from "@/components/FeatureGate";
import { MemoList } from "@/components/memolist";
import { PageHead } from "@/components/tasks";
import { VoiceRecorder } from "@/components/voice";
import { db } from "@/lib/db";
import { listMemos } from "@/lib/voice";

export const dynamic = "force-dynamic";
export default function Voice() {
  const memos = listMemos(80), projects = new Map((db.prepare("SELECT id, name FROM projects").all() as { id: number; name: string }[]).map((p) => [p.id, p.name]));
  return (
    <FeatureGate feature="voice">
      <div className="max-w-2xl">
        <PageHead title="Voice memos" sub="Say it. It becomes a task, a note or just a memo." />
        <div className="rise mb-8 rounded-2xl border bg-panel"><VoiceRecorder /></div>
        <MemoList memos={memos} projects={projects} />
      </div>
    </FeatureGate>
  );
}
