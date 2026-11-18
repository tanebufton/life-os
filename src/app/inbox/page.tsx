import Link from "next/link";
import { AddTaskRow } from "@/components/addrow";
import { FlashToast } from "@/components/flash";
import { Icon } from "@/components/Icon";
import { PageHead, TaskGroups } from "@/components/tasks";
import { isOn } from "@/lib/features";
import { queryTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export default async function Inbox({ searchParams }: { searchParams: Promise<{ shared?: string }> }) {
  const { shared } = await searchParams;
  const unsorted = queryTasks({ inbox: true });
  const fromEmail = unsorted.filter((t) => t.source === "email"), fromShare = unsorted.filter((t) => t.source === "share");
  const rest = unsorted.filter((t) => t.source !== "email" && t.source !== "share");
  return (
    <div className="mx-auto max-w-3xl">
      <FlashToast shared={!!shared} base="/inbox" />
      <PageHead title="Inbox" sub={unsorted.length ? `${unsorted.length} to sort. Give each a date or project and it leaves the inbox.` : "Everything captured lands here until you sort it."} />
      <TaskGroups groups={[{ label: "From email", tone: "accent", tasks: fromEmail }, { label: "Shared to LifeOS", tasks: fromShare }, { label: "Unsorted", tasks: rest }]}
        empty={<>Inbox zero. Anything you capture without a date or project lands here.</>} />
      <AddTaskRow />
      {isOn("email") && !fromEmail.length && (
        <Link href="/settings#email" className="mt-8 flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-[13px] text-mute hover:bg-raise/60"><Icon name="mail" size={18} className="text-accent" />Forward emails here to turn them into tasks. <span className="font-medium text-accent">Set up email import</span></Link>)}
    </div>
  );
}
