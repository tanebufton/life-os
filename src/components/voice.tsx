"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "./Icon";
import { saveMemoAction } from "@/lib/actions3";
import { deleteTaskInline } from "@/lib/actions";
import { clearDraft, peekDraft } from "@/lib/drafts";
import { useSession } from "./session";

type Rec = { lang: string; continuous: boolean; interimResults: boolean; onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void; onend: () => void; onerror: (e: { error: string }) => void; start: () => void; stop: () => void };
const ERR: Record<string, string> = { "not-allowed": "Microphone blocked. Allow it in the address bar and try again.", "service-not-allowed": "Microphone blocked. Allow it in the address bar and try again.", "no-speech": "I didn't hear anything. Try again.", "audio-capture": "No microphone found.", network: "Speech recognition needs a network connection in this browser." };
type Dest = "task" | "note" | "memo";
const DESTS: { k: Dest; label: string; done: string }[] = [{ k: "task", label: "Task", done: "Added as a task" }, { k: "note", label: "Note", done: "Saved as a note" }, { k: "memo", label: "Memo", done: "Memo saved" }];
const store = (k: string, v: string) => { try { localStorage.setItem(`lifeos:voice:${k}`, v); } catch { /* ignore */ } };
const recall = (k: string) => { try { return localStorage.getItem(`lifeos:voice:${k}`); } catch { return null; } };

/**
 * One button. Hold it and talk, let go and it's saved (as a task, note or memo, your choice). Or tap once to start and tap again to stop.
 * Turn on "review first" to check the words before they're saved.
 */
export function VoiceRecorder({ projectId }: { projectId?: number } = {}) {
  const [text, setText] = useState(""), [interim, setInterim] = useState(""), [on, setOn] = useState(false), [can, setCan] = useState(true), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [tap, setTap] = useState(false);
  const [dest, setDest] = useState<Dest>("task"), [review, setReview] = useState(false), [restored, setRestored] = useState(false);
  const rec = useRef<Rec | null>(null), base = useRef(""), textRef = useRef(""), { guarded } = useSession();
  const finishing = useRef(false), mode = useRef<"hold" | "tap" | null>(null), downAt = useRef(0), ignoreUp = useRef(false), destRef = useRef<Dest>("task"), reviewRef = useRef(false);
  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => { destRef.current = dest; reviewRef.current = review; }, [dest, review]);
  useEffect(() => { const d = recall("dest"); if (d === "task" || d === "note" || d === "memo") setDest(d); setReview(recall("review") === "1"); }, []);
  useEffect(() => { const d = peekDraft<string>("voice"); if (d?.value?.trim()) { setText(d.value); setRestored(true); } }, []);
  useEffect(() => { if (text.trim()) { try { localStorage.setItem("lifeos:draft:voice", JSON.stringify({ value: text, at: Date.now() })); } catch { /* ignore */ } } }, [text]);
  useEffect(() => { const w = window as never as Record<string, unknown>; setCan(!!(w.SpeechRecognition || w.webkitSpeechRecognition)); return () => rec.current?.stop(); }, []);

  async function commit(as: Dest, said: string) {
    setBusy(true);
    const g = await guarded("voice", said, () => saveMemoAction(said, as, projectId)), r = g.result;
    setBusy(false);
    if (g.saved && r?.ok) {
      clearDraft("voice"); setRestored(false); setText(""); setInterim(""); textRef.current = ""; setErr("");
      const short = said.length > 56 ? said.slice(0, 53) + "…" : said;
      toast(`${DESTS.find((d) => d.k === as)!.done}: ${short}`, { action: as === "task" && r.task_id ? { label: "Undo", onClick: () => void deleteTaskInline(r.task_id as number) } : undefined });
    } else if (g.reason && g.reason !== "error") setErr("Not saved yet. Your words are kept and will save when you're signed in again.");
    else setErr(r && !r.ok ? r.error : "Couldn't save. Try again.");
  }
  function afterStop() {
    const said = textRef.current.trim();
    if (!said) { setErr("I didn't catch anything. Try again."); return; }
    if (!reviewRef.current) void commit(destRef.current, said);
  }
  function start() {
    setErr(""); const W = window as never as Record<string, new () => Rec>, R = W.SpeechRecognition || W.webkitSpeechRecognition; if (!R) return;
    const r = new R(); r.lang = navigator.language || "en-NZ"; r.continuous = true; r.interimResults = true; base.current = text ? text.trimEnd() + " " : "";
    r.onresult = (e) => { let fin = "", tmp = ""; for (let i = 0; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript)); textRef.current = base.current + fin; setText(base.current + fin); setInterim(tmp); };
    r.onerror = (e) => { setErr(ERR[e.error] ?? `Speech error: ${e.error}`); setOn(false); setTap(false); mode.current = null; finishing.current = false; };
    r.onend = () => { setOn(false); setTap(false); setInterim(""); mode.current = null; if (finishing.current) { finishing.current = false; afterStop(); } };
    rec.current = r; setOn(true); r.start();
  }
  const finish = () => { if (!rec.current) return; finishing.current = true; rec.current.stop(); };
  /** Press: start (hold-to-talk), or if a tap-started recording is running, stop it. */
  const press = () => {
    if (!can || busy) return;
    if (on && mode.current === "tap") { ignoreUp.current = true; finish(); return; }
    if (on) return;
    downAt.current = Date.now(); mode.current = "hold"; start();
  };
  /** Release: a long hold ends the recording; a quick tap leaves it running until the next tap. */
  const release = () => {
    if (ignoreUp.current) { ignoreUp.current = false; return; }
    if (!on || mode.current !== "hold") return;
    if (Date.now() - downAt.current < 350) { mode.current = "tap"; setTap(true); return; }
    finish();
  };
  const pick = (d: Dest) => { setDest(d); store("dest", d); };
  const typed = text.trim().length > 0 && !on && (review || !can || !!restored || !!err);
  const label = DESTS.find((d) => d.k === dest)!;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-8 text-center">
      <button type="button" disabled={!can || busy} aria-label={on ? "Listening. Let go or tap to finish" : "Hold to talk"} aria-pressed={on} onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); press(); }} onPointerUp={release} onPointerCancel={release}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); press(); } }} onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); release(); } }}
        className={`relative grid h-24 w-24 touch-none select-none place-items-center rounded-full text-white outline-none transition focus-visible:ring-4 focus-visible:ring-accent/40 disabled:opacity-40 ${on ? "scale-105 bg-danger" : "bg-accent hover:brightness-110 active:scale-95"}`}>
        {on && <span className="absolute inset-0 animate-ping rounded-full bg-danger/30" aria-hidden />}
        <Icon name="mic" size={34} className="relative" />
      </button>

      <div className="min-h-[3rem]">
        {on ? (
          <><p className="text-[15px] font-medium text-danger">Listening…</p><p className="mt-0.5 text-[13px] text-mute">{tap ? "Tap the button again to finish" : "Let go when you're done"}</p></>
        ) : can ? (
          <><p className="text-[15px] font-medium">Hold to talk</p><p className="mt-0.5 text-[13px] text-mute">{review ? "Check the words, then save" : `Let go and it's saved as a ${label.k}`} · or tap once to start, again to stop</p></>
        ) : (
          <p className="text-[13px] text-mute">This browser can&apos;t listen (Chrome, Edge and Safari can). Type below, or use your keyboard&apos;s dictation key.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px]">
        <div role="group" aria-label="Save as" className="inline-flex rounded-lg border p-0.5">
          {DESTS.map((d) => <button key={d.k} type="button" aria-pressed={dest === d.k} onClick={() => pick(d.k)} className={`rounded-md px-3 py-1 ${dest === d.k ? "bg-raise font-medium" : "text-mute hover:text-fg"}`}>{d.label}</button>)}
        </div>
        <label className="flex items-center gap-2 text-mute"><input type="checkbox" checked={review} onChange={(e) => { setReview(e.target.checked); store("review", e.target.checked ? "1" : "0"); }} />Review first</label>
      </div>

      {(on || interim) && <p className="w-full rounded-lg bg-raise/60 px-4 py-3 text-left text-[15px] leading-relaxed text-mute" aria-live="polite">{text}{interim ? ` ${interim}` : ""}</p>}

      {(typed || (!can && !on)) && (
        <div className="w-full space-y-2 text-left">
          <textarea value={text} onChange={(e) => { setText(e.target.value); textRef.current = e.target.value; }} placeholder="Your words" aria-label="Transcript" rows={4} autoFocus={typed} className="field w-full resize-y text-[15px] leading-relaxed" />
          {restored && <p className="text-xs text-warn">Restored your unsaved words.</p>}
          <div className="flex items-center gap-2">
            <button className="btn-primary" disabled={busy || !text.trim()} onClick={() => void commit(dest, text.trim())}>Save as {label.k}</button>
            <button className="btn" onClick={() => { setText(""); textRef.current = ""; setRestored(false); clearDraft("voice"); }}>Discard</button>
          </div>
        </div>
      )}
      {err && <p className="text-[13px] text-danger" role="alert">{err}</p>}
      <p className="text-xs text-dim">Your browser turns speech into text (Chrome does this through Google). LifeOS only receives the text.</p>
    </div>
  );
}
