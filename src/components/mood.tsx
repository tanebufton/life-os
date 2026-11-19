"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveJournal } from "@/lib/actions";
import { Icon } from "./Icon";
import { MarkdownField } from "./mdfield";
import { ago, clearDraft, peekDraft } from "@/lib/drafts";
import { RestoreBanner, useSession } from "./session";

export const MOODS = ["Rough", "Meh", "Okay", "Good", "Great"];
export function MoodPicker({ date, value, compact }: { date: string; value: number | null; compact?: boolean }) {
  const [v, setV] = useState(value);
  const [, start] = useTransition(), { guarded } = useSession();
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Mood">
      {MOODS.map((m, i) => {
        const on = v === i + 1;
        return (
          <button key={m} role="radio" aria-checked={on} title={m} onClick={() => { const n = on ? null : i + 1; setV(n); start(async () => { await guarded(`journal-mood:${date}`, { mood: n }, () => saveJournal(date, { mood: n })); }); }}
            className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-1.5 transition ${compact ? "" : "min-w-14"} ${on ? "border-accent/50 bg-accent/10 text-accent" : "text-mute hover:bg-raise"}`}>
            <Icon name={`mood${i + 1}`} size={compact ? 18 : 22} />{!compact && <span className="text-[11px]">{m}</span>}
          </button>
        );
      })}
    </div>
  );
}
export function JournalEditor({ date, initial }: { date: string; initial: string }) {
  const [v, setV] = useState(initial), [state, setState] = useState<"idle" | "saving" | "saved" | "kept">("idle"), { guarded } = useSession(), dkey = `journal:${date}`, [found, setFound] = useState<{ value: { body: string }; at: number } | null>(null);
  useEffect(() => { const d = peekDraft<{ body: string }>(dkey); if (d && d.value.body !== initial) setFound(d); else if (d) clearDraft(dkey); }, [dkey, initial]);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined), last = useRef(initial);
  useEffect(() => { setV(initial); last.current = initial; setState("idle"); }, [date, initial]);
  const flush = async (val: string) => { if (val === last.current) return; setState("saving"); const g = await guarded(dkey, { body: val }, () => saveJournal(date, { body: val }), () => { last.current = val; setState("saved"); }); if (g.saved) { last.current = val; setState("saved"); } else setState("kept"); };
  return (
    <div>
      {found && <RestoreBanner at={ago(found.at)} what="journal text" onRestore={() => { setV(found.value.body); void flush(found.value.body); setFound(null); }} onDiscard={() => { clearDraft(dkey); setFound(null); }} />}
      <MarkdownField value={v} onChange={(x) => { setV(x); setState("idle"); clearTimeout(t.current); t.current = setTimeout(() => void flush(x), 800); }} onBlur={() => { clearTimeout(t.current); void flush(v); }} rows={12} label="Journal entry" placeholder="What's on your mind? What went well today? What would you do differently?" />
      <div className="mt-1.5 h-4 text-xs text-dim">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "kept" ? <span className="text-warn">Not saved yet. Kept safely in this browser</span> : v.length ? `${v.trim().split(/\s+/).filter(Boolean).length} words` : ""}</div>
    </div>
  );
}
