"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "./Icon";
import { saveMemoAction } from "@/lib/actions3";
import { deleteTaskInline } from "@/lib/actions";
import { clearDraft, peekDraft } from "@/lib/drafts";
import { useSession } from "./session";

type Rec = { lang: string; continuous: boolean; interimResults: boolean; onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void; onend: () => void; onerror: (e: { error: string }) => void; start: () => void; stop: () => void };
const ERR: Record<string, string> = { "not-allowed": "Microphone blocked. Allow it in the address bar and try again.", "service-not-allowed": "Microphone blocked. Allow it in the address bar and try again.", "no-speech": "I didn't hear anything. Try again.", "audio-capture": "No microphone found.", network: "Speech recognition needs a network connection in this browser." };

/** Record speech into an editable transcript, then save it as a memo, task or note. */
export function VoiceRecorder() {
  const [text, setText] = useState(""), [interim, setInterim] = useState(""), [on, setOn] = useState(false), [can, setCan] = useState(true), [err, setErr] = useState(""), [p, go] = useTransition();
  const rec = useRef<Rec | null>(null), base = useRef(""), { guarded } = useSession(), [restored, setRestored] = useState(false);
  const textRef = useRef(""), released = useRef(false), downAt = useRef(0), [auto, setAuto] = useState(true);
  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => { try { setAuto(localStorage.getItem("lifeos:voice:auto") !== "0"); } catch { /* default on */ } }, []);
  useEffect(() => { const d = peekDraft<string>("voice"); if (d?.value?.trim()) { setText(d.value); setRestored(true); } }, []);
  useEffect(() => { if (text.trim()) { try { localStorage.setItem("lifeos:draft:voice", JSON.stringify({ value: text, at: Date.now() })); } catch { /* ignore */ } } }, [text]);
  useEffect(() => { const w = window as never as Record<string, unknown>; setCan(!!(w.SpeechRecognition || w.webkitSpeechRecognition)); return () => rec.current?.stop(); }, []);
  const start = () => {
    setErr(""); const W = window as never as Record<string, new () => Rec>, R = W.SpeechRecognition || W.webkitSpeechRecognition; if (!R) return;
    const r = new R(); r.lang = navigator.language || "en-NZ"; r.continuous = true; r.interimResults = true; base.current = text ? text.trimEnd() + " " : "";
    r.onresult = (e) => { let fin = "", tmp = ""; for (let i = 0; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript)); textRef.current = base.current + fin; setText(base.current + fin); setInterim(tmp); };
    r.onerror = (e) => { setErr(ERR[e.error] ?? `Speech error: ${e.error}`); setOn(false); }; r.onend = () => { setOn(false); setInterim(""); if (released.current) { released.current = false; void afterRelease(); } };
    rec.current = r; setOn(true); r.start();
  };
  const stop = () => rec.current?.stop();
  /** Hold-to-talk: letting go stops listening, and (unless switched off) the words are added as a task straight away. */
  async function afterRelease() {
    const said = textRef.current.trim();
    if (Date.now() - downAt.current < 350) { setErr("Hold the button while you speak, then let go."); return; }
    if (!said) { setErr("I didn't catch anything. Hold the button while you speak."); return; }
    if (!auto) return; // leave the transcript to edit and save by hand
    const g = await guarded("voice", said, () => saveMemoAction(said, "task")); const r = g.result;
    if (g.saved && r?.ok) {
      clearDraft("voice"); setRestored(false); setText(""); setInterim(""); textRef.current = "";
      toast(`Added: ${said.length > 60 ? said.slice(0, 57) + "…" : said}`, { action: r.task_id ? { label: "Undo", onClick: () => void deleteTaskInline(r.task_id as number) } : undefined });
    } else if (g.reason && g.reason !== "error") setErr("Not added yet. Your words are kept safely and will be added when you're signed in again.");
    else setErr(r && !r.ok ? r.error : "Couldn't add that. Try again.");
  }
  const press = () => { if (on || !can) return; downAt.current = Date.now(); released.current = false; start(); };
  const release = () => { if (!rec.current || !on) return; released.current = true; rec.current.stop(); };
  const save = (as: "memo" | "task" | "note") => go(async () => { if (on) stop(); const g = await guarded("voice", text, () => saveMemoAction(text, as)); const r = g.result; if (g.saved && r?.ok) { clearDraft("voice"); setRestored(false); toast(as === "memo" ? "Memo saved" : as === "task" ? "Saved and added as a task" : "Saved and added as a note"); setText(""); setInterim(""); } else if (g.reason && g.reason !== "error") setErr("Not saved yet. Your transcript is kept safely and will save when you're signed in again."); else setErr(r && !r.ok ? r.error : "Couldn't save. Try again."); });
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-4">
        <button type="button" disabled={!can} aria-label="Hold to talk" aria-pressed={on} onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); press(); }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
          onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); press(); } }} onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); release(); } }}
          className={`grid h-20 w-20 shrink-0 touch-none select-none place-items-center rounded-full text-white shadow-sm outline-none transition focus-visible:ring-4 focus-visible:ring-accent/40 disabled:opacity-40 ${on ? "scale-110 bg-danger shadow-[0_0_0_8px_rgb(var(--danger)/0.2)]" : "bg-accent hover:brightness-110 active:scale-95"}`}><Icon name="mic" size={30} /></button>
        <div className="text-[13px] text-mute">{on ? <span className="font-medium text-danger">Listening… let go when you&apos;re done</span> : can ? <>{auto ? <><b className="text-fg">Hold</b> the button and speak. <b className="text-fg">Let go</b> to add it as a task.</> : <><b className="text-fg">Hold</b> the button and speak, then edit and save below.</>}<label className="mt-1.5 flex items-center gap-2 text-xs"><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); try { localStorage.setItem("lifeos:voice:auto", e.target.checked ? "1" : "0"); } catch { /* ignore */ } }} />Add as a task automatically when I let go</label></> : "This browser has no speech recognition (Chrome, Edge and Safari do). You can still type or use your keyboard's dictation key."}</div>
      </div>
      <div><textarea value={text + (interim ? (text && !text.endsWith(" ") ? " " : "") + interim : "")} onChange={(e) => { setText(e.target.value); setInterim(""); }} placeholder="Your words appear here…" aria-label="Transcript" rows={5} className="field w-full resize-y text-[15px] leading-relaxed" /></div>
      {restored && <p className="text-xs text-warn">Restored your unsaved transcript.</p>}
      {err && <p className="text-[13px] text-danger" role="alert">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={p || !text.trim()} onClick={() => save("task")}>Save as task</button>
        <button className="btn" disabled={p || !text.trim()} onClick={() => save("note")}>Save as note</button>
        <button className="btn" disabled={p || !text.trim()} onClick={() => save("memo")}>Memo only</button>
        {text && <button className="ml-auto text-xs text-mute hover:text-fg" onClick={() => { setText(""); setInterim(""); }}>Clear</button>}
      </div>
      <p className="text-xs text-dim">Tasks understand quick-add words: “call mum tomorrow at 5pm #family”. Speech is turned into text by your browser (Chrome sends audio to Google to do this); LifeOS only ever receives the text.</p>
    </div>
  );
}
