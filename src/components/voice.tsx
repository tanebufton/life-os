"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "./Icon";
import { saveMemoAction } from "@/lib/actions3";
import { clearDraft, peekDraft } from "@/lib/drafts";
import { useSession } from "./session";

type Rec = { lang: string; continuous: boolean; interimResults: boolean; onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void; onend: () => void; onerror: (e: { error: string }) => void; start: () => void; stop: () => void };
const ERR: Record<string, string> = { "not-allowed": "Microphone blocked. Allow it in the address bar and try again.", "service-not-allowed": "Microphone blocked. Allow it in the address bar and try again.", "no-speech": "I didn't hear anything. Try again.", "audio-capture": "No microphone found.", network: "Speech recognition needs a network connection in this browser." };

/** Record speech into an editable transcript, then save it as a memo, task or note. */
export function VoiceRecorder() {
  const [text, setText] = useState(""), [interim, setInterim] = useState(""), [on, setOn] = useState(false), [can, setCan] = useState(true), [err, setErr] = useState(""), [p, go] = useTransition();
  const rec = useRef<Rec | null>(null), base = useRef(""), { guarded } = useSession(), [restored, setRestored] = useState(false);
  useEffect(() => { const d = peekDraft<string>("voice"); if (d?.value?.trim()) { setText(d.value); setRestored(true); } }, []);
  useEffect(() => { if (text.trim()) { try { localStorage.setItem("lifeos:draft:voice", JSON.stringify({ value: text, at: Date.now() })); } catch { /* ignore */ } } }, [text]);
  useEffect(() => { const w = window as never as Record<string, unknown>; setCan(!!(w.SpeechRecognition || w.webkitSpeechRecognition)); return () => rec.current?.stop(); }, []);
  const start = () => {
    setErr(""); const W = window as never as Record<string, new () => Rec>, R = W.SpeechRecognition || W.webkitSpeechRecognition; if (!R) return;
    const r = new R(); r.lang = navigator.language || "en-NZ"; r.continuous = true; r.interimResults = true; base.current = text ? text.trimEnd() + " " : "";
    r.onresult = (e) => { let fin = "", tmp = ""; for (let i = 0; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript)); setText(base.current + fin); setInterim(tmp); };
    r.onerror = (e) => { setErr(ERR[e.error] ?? `Speech error: ${e.error}`); setOn(false); }; r.onend = () => { setOn(false); setInterim(""); };
    rec.current = r; setOn(true); r.start();
  };
  const stop = () => rec.current?.stop();
  const save = (as: "memo" | "task" | "note") => go(async () => { if (on) stop(); const g = await guarded("voice", text, () => saveMemoAction(text, as)); const r = g.result; if (g.saved && r?.ok) { clearDraft("voice"); setRestored(false); toast(as === "memo" ? "Memo saved" : as === "task" ? "Saved and added as a task" : "Saved and added as a note"); setText(""); setInterim(""); } else if (g.reason && g.reason !== "error") setErr("Not saved yet. Your transcript is kept safely and will save when you're signed in again."); else setErr(r && !r.ok ? r.error : "Couldn't save. Try again."); });
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-4">
        <button type="button" onClick={on ? stop : start} disabled={!can} aria-label={on ? "Stop recording" : "Start recording"} className={`grid h-16 w-16 shrink-0 place-items-center rounded-full text-white shadow-sm transition disabled:opacity-40 ${on ? "animate-pulse bg-danger" : "bg-accent hover:brightness-110"}`}><Icon name={on ? "pause" : "mic"} size={26} /></button>
        <div className="text-[13px] text-mute">{on ? <span className="font-medium text-danger">Listening… press to stop</span> : can ? "Press the button and speak. You can edit the text before saving." : "This browser has no speech recognition (Chrome, Edge and Safari do). You can still type or use your keyboard's dictation key."}</div>
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
