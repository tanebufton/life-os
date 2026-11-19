"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { logFocus } from "@/lib/actions";
import { Icon } from "./Icon";
import { Panel } from "./Panel";

// ---- shared helpers ----
let audio: AudioContext | null = null;
export const unlockAudio = () => { try { audio ??= new AudioContext(); void audio.resume(); } catch {} };
export function beep(times = 3) {
  try {
    if (!audio) return;
    for (let i = 0; i < times; i++) {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.35;
      o.frequency.value = 880; g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.25);
    }
  } catch {}
}
export const notify = (title: string, body: string) => { try { if (Notification.permission === "granted") new Notification(title, { body }); } catch {} };
const askNotify = () => { try { if (Notification.permission === "default") void Notification.requestPermission(); } catch {} };
export const mmss = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
export function load<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } }
export function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

// ---- pomodoro ----
export type Mode = "focus" | "short" | "long";
export type P = { mode: Mode; total: number; endsAt: number | null; left: number; taskId: number | null; cycles: number };
export const MINUTES: Record<Mode, number> = { focus: 25, short: 5, long: 15 };
export const LABEL: Record<Mode, string> = { focus: "Focus", short: "Short break", long: "Long break" };
const initial: P = { mode: "focus", total: 25 * 60, endsAt: null, left: 25 * 60, taskId: null, cycles: 0 };

export function Pomodoro({ tasks, presetTask }: { tasks: { id: number; title: string }[]; presetTask?: number | null }) {
  const [p, setP] = useState<P>(initial);
  const [ready, setReady] = useState(false);
  const [mins, setMins] = useState(MINUTES);
  const finishing = useRef(false);

  useEffect(() => { const saved = load("lifeos.pomo", initial); setP(presetTask ? { ...saved, mode: "focus", taskId: presetTask, ...(saved.endsAt ? {} : { total: (load("lifeos.pomo.mins", MINUTES).focus) * 60, left: (load("lifeos.pomo.mins", MINUTES).focus) * 60 }) } : saved); setMins(load("lifeos.pomo.mins", MINUTES)); setReady(true); }, [presetTask]);
  useEffect(() => { if (ready) save("lifeos.pomo", p); }, [p, ready]);

  const finish = useCallback((cur: P) => {
    if (finishing.current) return;
    finishing.current = true;
    beep(); notify(cur.mode === "focus" ? "Focus session done 🎉" : "Break over", cur.mode === "focus" ? "Time for a break." : "Back to it.");
    const cycles = cur.mode === "focus" ? cur.cycles + 1 : cur.cycles;
    const next: Mode = cur.mode === "focus" ? (cycles % 4 === 0 ? "long" : "short") : "focus";
    if (cur.mode === "focus") void logFocus(cur.total, "focus", cur.taskId, tasks.find((t) => t.id === cur.taskId)?.title ?? "");
    setP({ ...cur, mode: next, total: mins[next] * 60, left: mins[next] * 60, endsAt: null, cycles });
    finishing.current = false;
  }, [mins, tasks]);

  useEffect(() => {
    if (!p.endsAt) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((p.endsAt! - Date.now()) / 1000));
      if (left <= 0) finish(p); else setP((x) => (x.endsAt === p.endsAt ? { ...x, left } : x));
    };
    tick(); const i = setInterval(tick, 500); return () => clearInterval(i);
  }, [p.endsAt, p, finish]);

  useEffect(() => {
    if (!p.endsAt) return;
    const old = document.title; document.title = `${mmss(p.left)} · ${LABEL[p.mode]}`;
    return () => { document.title = old; };
  }, [p.left, p.mode, p.endsAt]);

  const running = p.endsAt !== null;
  const start = () => { unlockAudio(); askNotify(); setP({ ...p, endsAt: Date.now() + p.left * 1000 }); };
  const pause = () => setP({ ...p, endsAt: null, left: Math.max(1, Math.ceil((p.endsAt! - Date.now()) / 1000)) });
  const reset = () => setP({ ...p, endsAt: null, left: p.total });
  const pick = (m: Mode) => setP({ ...p, mode: m, total: mins[m] * 60, left: mins[m] * 60, endsAt: null });
  const frac = p.total ? (p.total - p.left) / p.total : 0;
  const R = 116, C = 2 * Math.PI * R;
  const round = (p.cycles % 4) + 1;

  return (
    <Panel title="Pomodoro" i={0} right={<span>{p.cycles} completed</span>}>
      <div className="flex flex-col items-center px-4 pb-7 pt-3">
        <div className="mb-6 inline-flex rounded-full bg-raise p-1">
          {(Object.keys(LABEL) as Mode[]).map((m) => (
            <button key={m} onClick={() => pick(m)} className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${p.mode === m ? "bg-panel shadow-sm" : "text-mute hover:text-fg"}`}>{LABEL[m]}</button>
          ))}
        </div>
        <div className="relative grid place-items-center">
          <svg width="268" height="268" viewBox="0 0 268 268" className="-rotate-90">
            <circle cx="134" cy="134" r={R} fill="none" stroke="rgb(var(--fg) / .08)" strokeWidth="8" />
            <circle cx="134" cy="134" r={R} fill="none" stroke="rgb(var(--accent))" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: running ? "stroke-dashoffset .5s linear" : "none" }} />
          </svg>
          <div className="absolute text-center">
            <div className="text-[60px] font-light leading-none tabular-nums tracking-tight">{mmss(p.left)}</div>
            <div className="mt-2 text-[13px] text-mute">{ready ? (running ? LABEL[p.mode] : p.left < p.total ? "Paused" : "Ready to start") : " "} · Round {round} of 4</div>
          </div>
        </div>
        {p.mode === "focus" && (
          <select value={p.taskId ?? ""} onChange={(e) => setP({ ...p, taskId: Number(e.target.value) || null })} className="field mt-6 max-w-xs" aria-label="Task to focus on">
            <option value="">No specific task</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        )}
        <div className="mt-6 flex items-center gap-2.5">
          {running ? <button className="btn-primary !h-11 min-w-32 !rounded-full !text-[15px]" onClick={pause}><Icon name="pause" size={14} />Pause</button> : <button className="btn-primary !h-11 min-w-32 !rounded-full !text-[15px]" onClick={start}><Icon name="play" size={14} />{p.left < p.total ? "Resume" : "Start"}</button>}
          <button className="btn !h-11 !rounded-full !px-5" onClick={reset}>Reset</button>
          <button className="btn !h-11 !rounded-full !px-5" onClick={() => finish({ ...p, total: p.total - p.left || p.total })} title="Finish early and log elapsed time" disabled={p.left === p.total}>Finish</button>
        </div>
        <details className="mt-6 w-full max-w-xs text-sm text-mute">
          <summary className="cursor-pointer text-center text-[13px] hover:text-fg">Durations</summary>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(Object.keys(LABEL) as Mode[]).map((m) => (
              <label key={m} className="flex flex-col gap-1 text-center text-xs">{LABEL[m]}
                <input type="number" min={1} max={180} value={mins[m]} className="field text-center"
                  onChange={(e) => { const v = Math.max(1, Math.min(180, Number(e.target.value) || 1)); const n = { ...mins, [m]: v }; setMins(n); save("lifeos.pomo.mins", n); if (!running && p.mode === m) setP({ ...p, total: v * 60, left: v * 60 }); }} />
              </label>
            ))}
          </div>
        </details>
      </div>
    </Panel>
  );
}

// ---- free timers ----
export type T = { id: string; label: string; total: number; endsAt: number; done: boolean };
export function Timers() {
  const [timers, setTimers] = useState<T[]>([]);
  const [now, setNow] = useState(0);
  const [label, setLabel] = useState("");
  const [mins, setMins] = useState("10");
  const [ready, setReady] = useState(false);

  useEffect(() => { setTimers(load("lifeos.timers", [])); setNow(Date.now()); setReady(true); }, []);
  useEffect(() => { if (ready) save("lifeos.timers", timers); }, [timers, ready]);
  useEffect(() => {
    const i = setInterval(() => {
      const n = Date.now(); setNow(n);
      setTimers((ts) => {
        let fired = false;
        const out = ts.map((t) => { if (!t.done && t.endsAt <= n) { fired = true; notify("Timer done", t.label || mmss(t.total)); return { ...t, done: true }; } return t; });
        if (fired) beep();
        return fired ? out : ts;
      });
    }, 500);
    return () => clearInterval(i);
  }, []);

  const add = (m: number, l = label) => {
    if (!(m > 0)) return;
    unlockAudio(); askNotify();
    setTimers((ts) => [...ts, { id: crypto.randomUUID(), label: l.trim(), total: Math.round(m * 60), endsAt: Date.now() + m * 60_000, done: false }]);
    setLabel("");
  };

  return (
    <Panel title="Timers" count={timers.length || undefined} i={1}>
      <div className="space-y-3 px-4 pb-4 pt-1">
        <div className="flex flex-wrap gap-1.5">
          {[1, 3, 5, 10, 15, 30].map((m) => <button key={m} onClick={() => add(m, "")} className="btn !h-7 !rounded-full !px-3 text-xs">{m} min</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); add(Number(mins)); }} className="flex gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (tea, laundry…)" className="field min-w-0 flex-1" />
          <input value={mins} onChange={(e) => setMins(e.target.value)} inputMode="decimal" aria-label="Minutes" className="field w-16 text-center" />
          <button className="btn-primary">Start</button>
        </form>
        <ul className="space-y-1.5">
          {timers.map((t) => {
            const left = Math.max(0, Math.ceil((t.endsAt - now) / 1000));
            const pct = t.done ? 100 : ((t.total - left) / t.total) * 100;
            return (
              <li key={t.id} className={`relative overflow-hidden rounded-lg border px-3 py-2.5 ${t.done ? "border-warn/50 bg-warn/10" : ""}`}>
                <div className="absolute inset-y-0 left-0 bg-accent/10" style={{ width: `${pct}%` }} />
                <div className="relative flex items-center justify-between">
                  <span className="truncate text-sm font-medium">{t.label || mmss(t.total)}</span>
                  <span className="flex items-center gap-3"><span className={`text-xl font-light tabular-nums ${t.done ? "font-medium text-warn" : ""}`}>{t.done ? "Time's up" : mmss(left)}</span>
                    <button onClick={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))} aria-label="Remove timer" className="text-dim hover:text-danger"><Icon name="x" size={15} /></button></span>
                </div>
              </li>
            );
          })}
          {ready && !timers.length && <li className="text-[13px] text-dim">No timers running. Tap a preset to start one.</li>}
        </ul>
      </div>
    </Panel>
  );
}
