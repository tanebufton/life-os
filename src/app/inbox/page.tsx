import Link from "next/link";
import { AddTaskRow } from "@/components/addrow";
import { FlashToast } from "@/components/flash";
import { Icon } from "@/components/Icon";
import { PageHead, TaskGroups } from "@/components/tasks";
import { isOn } from "@/lib/features";
import { queryTasks } from "@/lib/tasks";
import { MemoList } from "@/components/memolist";
import { db } from "@/lib/db";
import { listMemos } from "@/lib/voice";

export const dynamic = "force-dynamic";
export default async function Inbox({ searchParams }: { searchParams: Promise<{ shared?: string; tab?: string }> }) {
  const { shared, tab: t } = await searchParams, memos = isOn("voice") ? listMemos(200) : [], voice = memos.length > 0, tab = voice && t === "memos" ? "memos" : "tasks";
  const unsorted = queryTasks({ inbox: true });
  const fromEmail = unsorted.filter((t) => t.source === "email"), fromShare = unsorted.filter((t) => t.source === "share");
  const rest = unsorted.filter((t) => t.source !== "email" && t.source !== "share");
  return (
    <div>
      <FlashToast shared={!!shared} base="/inbox" />
      <PageHead title="Inbox" sub={unsorted.length ? `${unsorted.length} to sort. Give each a date or project and it leaves the inbox.` : "Everything captured lands here until you sort it."} />
      {voice && (
        <nav aria-label="Inbox views" className="mb-6 flex gap-0.5 border-b">
          {[["tasks", "Tasks", "inbox", unsorted.length], ["memos", "Voice memos", "mic", memos.length]].map(([k, label, icon, n]) => (
            <Link key={k as string} href={k === "tasks" ? "/inbox" : "/inbox?tab=memos"} aria-current={tab === k ? "page" : undefined} className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[14px] ${tab === k ? "border-accent font-medium text-fg" : "border-transparent text-mute hover:text-fg"}`}>
              <Icon name={icon as string} size={15} className={tab === k ? "text-accent" : ""} />{label}{n ? <span className="text-xs text-dim">{n}</span> : null}</Link>))}
        </nav>)}
      {tab === "memos" ? (
        <div className="space-y-4"><div className="flex items-center justify-between gap-3"><p className="text-[13px] text-mute">Memos sent from the Chrome extension, Telegram or the API. To capture by voice, hold the mic in the add-task bar at the top.</p><a href="/inbox/memos/print" target="_blank" rel="noopener" className="btn shrink-0"><Icon name="download" size={14} />Export PDF</a></div><MemoList memos={memos} projects={new Map((db.prepare("SELECT id, name FROM projects").all() as { id: number; name: string }[]).map((p) => [p.id, p.name]))} /></div>
      ) : (<>
      <TaskGroups groups={[{ label: "From email", tone: "accent", tasks: fromEmail }, { label: "Shared to LifeOS", tasks: fromShare }, { label: "Unsorted", tasks: rest }]}
        empty={<>Inbox zero. Anything you capture without a date or project lands here.</>} />
      <AddTaskRow />
      </>)}
      {tab === "tasks" && isOn("email") && !fromEmail.length && (
        <Link href="/settings?tab=connect#email" className="mt-8 flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-[13px] text-mute hover:bg-raise/60"><Icon name="mail" size={18} className="text-accent" />Forward emails here to turn them into tasks. <span className="font-medium text-accent">Set up email import</span></Link>)}
    </div>
  );
}
