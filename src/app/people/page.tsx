import { FeatureGate } from "@/components/FeatureGate";
import { Panel } from "@/components/Panel";
import { ProjectAvatar } from "@/components/Pill";
import { PageHead } from "@/components/tasks";
import { addPersonAction, archivePersonAction, followUpAction, logContactAction } from "@/lib/actions3";
import { nice } from "@/lib/dates";
import { catchUpIn, interactions, listPeople, nextBirthday } from "@/lib/people";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export default function People() {
  const t = today(), people = listPeople().map((p) => ({ p, n: catchUpIn(p, t), b: nextBirthday(p, t) })).sort((a, b) => (a.n ?? 9999) - (b.n ?? 9999));
  return (
    <FeatureGate feature="people">
      <div className="max-w-4xl">
        <PageHead title="People" sub="Keep in touch with the people who matter" />
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel i={0}><ul>{people.map(({ p, n, b }) => (
            <li key={p.id} className="border-b px-4 py-3.5 last:border-b-0">
              <div className="flex items-center gap-3"><ProjectAvatar name={p.name} color="#6366f1" size={36} />
                <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-semibold">{p.name}</div>
                  <div className="text-xs text-mute">{p.last_contact ? `Last spoke ${nice(p.last_contact)}` : "No contact logged"}{p.cadence_days ? ` · every ${p.cadence_days} days` : ""}{b ? ` · birthday ${b.in === 0 ? "today" : `in ${b.in} days`}${b.age ? ` (${b.age})` : ""}` : ""}</div></div>
                {n !== null && <span className={`lozenge ${n <= 0 ? "bg-warn/15 text-warn" : "bg-raise text-mute"}`}>{n <= 0 ? `${-n || 0}d overdue` : `in ${n}d`}</span>}</div>
              <div className="mt-2 flex flex-wrap gap-2 pl-12 text-xs"><form action={logContactAction.bind(null, p.id, "")}><button className="btn !px-2.5 !py-1">Log catch-up</button></form><form action={followUpAction.bind(null, p.id)}><button className="btn !px-2.5 !py-1">Add reminder task</button></form><form action={archivePersonAction.bind(null, p.id)}><button className="px-1 py-1 text-dim hover:text-danger">Remove</button></form></div>
              {p.notes && <p className="mt-2 pl-12 text-[13px] text-mute">{p.notes}</p>}
              {interactions(p.id, 2).length > 0 && <p className="mt-1 pl-12 text-xs text-dim">{interactions(p.id, 2).map((x) => nice(x.date)).join(" · ")}</p>}
            </li>))}
            {!people.length && <li className="px-4 py-12 text-center text-sm text-mute">Add the people you want to stay in touch with. Set how often, and LifeOS will nudge you.</li>}</ul></Panel>
          <Panel title="Add a person" i={1}><form action={addPersonAction} className="space-y-2.5 px-4 pb-4"><input name="name" required placeholder="Name" className="field" /><label className="block text-xs text-mute">Birthday<input type="date" name="birthday" className="field mt-1" /></label><label className="block text-xs text-mute">Catch up every (days)<input name="cadence" inputMode="numeric" placeholder="e.g. 30" className="field mt-1" /></label><textarea name="notes" rows={2} placeholder="Notes: partner's name, gift ideas…" className="field" /><button className="btn-primary w-full">Add</button></form></Panel>
        </div>
      </div>
    </FeatureGate>
  );
}
