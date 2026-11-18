import Link from "next/link";
import { getEntry } from "@/lib/journal";
import { habitsToday } from "@/lib/habits";
import { today } from "@/lib/time";
import { HabitCheck } from "./habitui";
import { Icon } from "./Icon";
import { MoodPicker } from "./mood";
import { Panel } from "./Panel";

export function HabitsPanel({ i = 0 }: { i?: number }) {
  const hs = habitsToday().filter((h) => h.scheduled);
  const done = hs.filter((h) => h.done).length;
  return (
    <Panel title="Habits" count={hs.length ? `${done}/${hs.length}` : undefined} i={i} right={<Link href="/habits" className="font-medium text-accent hover:underline">Manage</Link>}>
      {hs.length ? (
        <ul className="pb-1.5">{hs.map((h) => (
          <li key={h.id} className="flex items-center gap-3 px-4 py-2"><HabitCheck id={h.id} done={h.done} scheduled color={h.color} />
            <span className={`flex-1 text-[14px] ${h.done ? "text-dim" : ""}`}>{h.name}</span>
            {h.streak > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-warn" title={`${h.streak} day streak`}><Icon name="flame" size={13} />{h.streak}</span>}</li>))}</ul>
      ) : <p className="px-4 pb-4 text-sm text-mute">No habits scheduled today. <Link href="/habits" className="font-medium text-accent hover:underline">Add one</Link></p>}
    </Panel>
  );
}
export function JournalPanel({ i = 0 }: { i?: number }) {
  const t = today(), e = getEntry(t);
  return (
    <Panel title="Journal" i={i} right={<Link href="/journal" className="font-medium text-accent hover:underline">{e?.body ? "Continue" : "Write"}</Link>}>
      <div className="px-4 pb-4">
        <p className="mb-2.5 text-[13px] text-mute">How are you feeling today?</p>
        <MoodPicker date={t} value={e?.mood ?? null} compact />
        {e?.body && <p className="mt-3 line-clamp-2 text-[13px] text-mute">{e.body}</p>}
      </div>
    </Panel>
  );
}
