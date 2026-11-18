"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveJournal } from "@/lib/actions";
import { Icon } from "./Icon";

export const MOODS = ["Rough", "Meh", "Okay", "Good", "Great"];
export function MoodPicker({ date, value, compact }: { date: string; value: number | null; compact?: boolean }) {
  const [v, setV] = useState(value);
  const [, start] = useTransition();
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Mood">
      {MOODS.map((m, i) => {
        const on = v === i + 1;
        return (
          <button key={m} role="radio" aria-checked={on} title={m} onClick={() => { const n = on ? null : i + 1; setV(n); start(async () => { await saveJournal(date, { mood: n }); }); }}
            className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-1.5 transition ${compact ? "" : "min-w-14"} ${on ? "border-accent/50 bg-accent/10 text-accent" : "text-mute hover:bg-raise"}`}>
            <Icon name={`mood${i + 1}`} size={compact ? 18 : 22} />{!compact && <span className="text-[11px]">{m}</span>}
          </button>
        );
      })}
    </div>
  );
}
export function JournalEditor({ date, initial }: { date: string; initial: string }) {
  const [v, setV] = useState(initial), [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const t = useRef<ReturnType<typeof setTimeout>>(undefined), last = useRef(initial);
  useEffect(() => { setV(initial); last.current = initial; setState("idle"); }, [date, initial]);
  const flush = async (val: string) => { if (val === last.current) return; setState("saving"); await saveJournal(date, { body: val }); last.current = val; setState("saved"); };
  return (
    <div>
      <textarea value={v} onChange={(e) => { setV(e.target.value); setState("idle"); clearTimeout(t.current); t.current = setTimeout(() => void flush(e.target.value), 800); }} onBlur={() => { clearTimeout(t.current); void flush(v); }}
        rows={12} placeholder="What's on your mind? What went well today? What would you do differently?" className="w-full resize-y rounded-xl border bg-panel p-4 text-[15px] leading-relaxed outline-none placeholder:text-dim focus:border-accent focus:ring-2 focus:ring-accent/25" />
      <div className="mt-1.5 h-4 text-xs text-dim">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : v.length ? `${v.trim().split(/\s+/).filter(Boolean).length} words` : ""}</div>
    </div>
  );
}
