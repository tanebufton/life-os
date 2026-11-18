"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { logFocus } from "@/lib/actions";
import { btn, btn2, card, input } from "./ui";

// ---- shared helpers ----
let audio: AudioContext | null = null;
const unlockAudio = () => { try { audio ??= new AudioContext(); void audio.resume(); } catch {} };
function beep(times = 3) {
  try {
    if (!audio) return;
    for (let i = 0; i < times; i++) {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.35;
      o.frequency.value = 880; g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.25);
    }
  } catch {}
}
const notify = (title: string, body: string) => { try { if (Notification.permission === "granted") new Notification(title, { body }); } catch {} };
const askNotify = () => { try { if (Notification.permission === "default") void Notification.requestPermission(); } catch {} };
const mmss = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
function load<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } }
function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

// ---- pomodoro ----
type Mode = "focus" | "short" | "long";
type P = { mode: Mode; total: number; endsAt: number | null; left: number; taskId: number | null; cycles: number };
const MINUTES: Record<Mode, number> = { focus: 25, short: 5, long: 15 };
const LABEL: Record<Mode, string> = { focus: "Focus", short: "Short break", long: "Long break" };
const initial: P = { mode: "focus", total: 25 * 60, endsAt: null, left: 25 * 60, taskId: null, cycles: 0 };

export function Pomodoro({ tasks }: { tasks: { id: number; title: string }[] }) {
  const [p, setP] = useState<P>(initial);
  const [ready, setReady] = useState(false);
  const [mins, setMins] = useState(MINUTES);
  const finishing = useRef(false);

  useEffect(() => { setP(load("lifeos.pomo", initial)); setMins(load("lifeos.pomo.mins", MINUTES)); setReady(true); }, []);
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
  const pct = p.total ? ((p.total - p.left) / p.total) * 100 : 0;

  return (
    <div className={`${card} text-center`}>
      <div className="mb-3 flex justify-center gap-1">
        {(Object.keys(LABEL) as Mode[]).map((m) => (
          <button key={m} onClick={() => pick(m)} className={`rounded-full px-3 py-1 text-sm ${p.mode === m ? "bg-indigo-600 text-white" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>{LABEL[m]}</button>
        ))}
      </div>
      <div className="relative mx-auto my-2 grid h-52 w-52 place-items-center rounded-full"
        style={{ background: `conic-gradient(rgb(99 102 241) ${pct}%, rgba(128,128,128,.2) 0)` }}>
        <div className="grid h-44 w-44 place-items-center rounded-full bg-white dark:bg-neutral-900">
          <div><div className="text-5xl font-semibold tabular-nums">{mmss(p.left)}</div><div className="text-xs text-neutral-500">{ready ? `round ${(p.cycles % 4) + 1} of 4` : " "}</div></div>
        </div>
      </div>
      {p.mode === "focus" && (
        <select value={p.taskId ?? ""} onChange={(e) => setP({ ...p, taskId: Number(e.target.value) || null })} className={`${input} mt-2 w-full max-w-xs`} aria-label="Task to focus on">
          <option value="">No specific task</option>
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      )}
      <div className="mt-4 flex justify-center gap-2">
        {running ? <button className={btn} onClick={pause}>Pause</button> : <button className={btn} onClick={start}>{p.left < p.total ? "Resume" : "Start"}</button>}
        <button className={btn2} onClick={reset}>Reset</button>
        <button className={btn2} onClick={() => finish({ ...p, total: p.total - p.left || p.total })} title="Finish early and log elapsed time" disabled={p.left === p.total}>Done</button>
      </div>
      <details className="mt-4 text-left text-sm text-neutral-500">
        <summary className="cursor-pointer text-center">Durations</summary>
        <div className="mt-2 flex justify-center gap-3">
          {(Object.keys(LABEL) as Mode[]).map((m) => (
            <label key={m} className="flex flex-col items-center gap-1">{LABEL[m]}
              <input type="number" min={1} max={180} value={mins[m]} className={`${input} w-20 text-center`}
                onChange={(e) => { const v = Math.max(1, Math.min(180, Number(e.target.value) || 1)); const n = { ...mins, [m]: v }; setMins(n); save("lifeos.pomo.mins", n); if (!running && p.mode === m) setP({ ...p, total: v * 60, left: v * 60 }); }} />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

// ---- free timers ----
type T = { id: string; label: string; total: number; endsAt: number; done: boolean };
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
    <div className={card}>
      <h2 className="mb-3 font-semibold">Timers</h2>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[1, 3, 5, 10, 15, 30].map((m) => <button key={m} onClick={() => add(m, "")} className={`${btn2} !px-2.5 !py-1 text-sm`}>{m}m</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); add(Number(mins)); }} className="mb-3 flex gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (tea, laundry…)" className={`${input} min-w-0 flex-1`} />
        <input value={mins} onChange={(e) => setMins(e.target.value)} inputMode="decimal" aria-label="Minutes" className={`${input} w-16 text-center`} />
        <button className={btn}>Start</button>
      </form>
      <ul className="space-y-2">
        {timers.map((t) => {
          const left = Math.max(0, Math.ceil((t.endsAt - now) / 1000));
          return (
            <li key={t.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${t.done ? "bg-amber-100 dark:bg-amber-950" : "bg-neutral-100 dark:bg-neutral-800"}`}>
              <span className="truncate">{t.label || mmss(t.total)}</span>
              <span className="flex items-center gap-3">
                <span className="text-lg font-semibold tabular-nums">{t.done ? "Done!" : mmss(left)}</span>
                <button onClick={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))} aria-label="Remove timer" className="text-neutral-500 hover:text-red-500">×</button>
              </span>
            </li>
          );
        })}
        {ready && !timers.length && <li className="text-sm text-neutral-500">No timers running.</li>}
      </ul>
    </div>
  );
}
