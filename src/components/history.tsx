import { describeEvent, history, type Entity } from "@/lib/activity";
import { tz } from "@/lib/time";
import { noteVersions, restoreNoteVersion } from "@/lib/notes";
import { revalidatePath } from "next/cache";

export const fmtAt = (at: string) => new Intl.DateTimeFormat("en-NZ", { timeZone: tz(), day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(at.replace(" ", "T") + "Z"));
const actorLabel = (a: string) => (a === "you" ? null : a.startsWith("api:") ? `API · ${a.slice(4)}` : a);
/** What changed, when, and by whom. Collapsed by default so it doesn't crowd the page. */
export function History({ entity, id, noteId }: { entity: Entity; id: number; noteId?: number }) {
  const events = history(entity, id, 80), versions = noteId ? noteVersions(noteId) : [];
  return (
    <details className="group mt-6 rounded-xl border bg-panel" id="history">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-semibold marker:content-['']"><span className="text-mute transition group-open:rotate-90">›</span>History <span className="font-normal text-dim">{events.length || ""}</span></summary>
      <div className="border-t px-4 py-3">
        {versions.length > 0 && (
          <div className="mb-4"><div className="mb-1.5 text-xs font-semibold text-mute">Earlier versions</div>
            <ul className="divide-y rounded-lg border">{versions.slice(0, 15).map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-3 py-2 text-[13px]"><span className="w-28 shrink-0 text-xs text-mute">{fmtAt(v.at)}</span><span className="min-w-0 flex-1 truncate text-mute">{v.body.replace(/\s+/g, " ").slice(0, 90) || "(empty)"}</span>
                <form action={async () => { "use server"; restoreNoteVersion(noteId!, v.id); revalidatePath(`/notes/${noteId}`); }}><button className="text-xs text-accent hover:underline">Restore</button></form></li>))}</ul></div>)}
        <ol className="space-y-2">{events.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]"><span className="w-28 shrink-0 text-xs text-dim">{fmtAt(e.at)}</span><span>{describeEvent(e)}</span>{actorLabel(e.actor) && <span className="lozenge bg-raise text-mute">{actorLabel(e.actor)}</span>}</li>))}
          {!events.length && <li className="text-[13px] text-mute">Nothing recorded yet. Changes from now on will appear here.</li>}</ol>
      </div>
    </details>
  );
}
