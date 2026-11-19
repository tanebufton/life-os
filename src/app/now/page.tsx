import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/tasks";
import { toggleTask } from "@/lib/actions";
import { nextBest } from "@/lib/misc";
import { dueInfo } from "@/components/tasks";

export const dynamic = "force-dynamic";
export default async function Now({ searchParams }: { searchParams: Promise<{ skip?: string }> }) {
  const skip = ((await searchParams).skip ?? "").split(",").map(Number).filter(Boolean), t = nextBest(skip);
  return (
    <div className="mx-auto max-w-xl pt-6 text-center">
      <PageHead title="Do this now" sub="One thing. Everything else can wait." />
      {t ? (
        <div className="card rise p-6 text-left"><div className="text-xs font-medium uppercase tracking-wide text-dim">{t.project_name ?? "No project"}{t.due ? ` · ${dueInfo(t.due, false).text}` : ""}{t.estimate ? ` · ${t.estimate} min` : ""}</div>
          <h2 className="mt-2 text-[22px] font-semibold leading-snug">{t.title}</h2>{t.notes && <p className="mt-2 line-clamp-4 text-[14px] text-mute">{t.notes}</p>}
          <div className="mt-5 flex flex-wrap gap-2"><Link href={`/focus?task=${t.id}`} className="btn-primary"><Icon name="focus" size={14} />Start focus</Link>
            <form action={async () => { "use server"; await toggleTask(t.id); }}><button className="btn">Mark done</button></form>
            <Link href={`/now?skip=${[...skip, t.id].join(",")}`} className="btn">Skip</Link><Link href={`/tasks/${t.id}`} className="btn">Open</Link></div></div>
      ) : <div className="card rise p-10 text-sm text-mute">Nothing left to do{skip.length ? " (after skipping)" : ""}. <Link href="/now" className="underline">Reset</Link></div>}
    </div>
  );
}
