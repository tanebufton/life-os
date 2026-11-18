"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { spotifyControl } from "@/lib/actions";
import type { Now } from "@/lib/spotify";
import { Icon } from "./Icon";
import { Panel } from "./Panel";

const mmss = (ms = 0) => `${Math.floor(ms / 60000)}:${Math.floor((ms % 60000) / 1000).toString().padStart(2, "0")}`;

export function SpotifyPanel({ i = 0 }: { i?: number }) {
  const [s, setS] = useState<Now | null>(null);
  const [msg, setMsg] = useState("");
  const poll = useCallback(async () => { try { setS(await (await fetch("/api/spotify/now", { cache: "no-store" })).json()); } catch {} }, []);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>, dead = false;
    const loop = async () => { await poll(); if (!dead) t = setTimeout(loop, document.hidden ? 30_000 : 5_000); };
    void loop(); return () => { dead = true; clearTimeout(t); };
  }, [poll]);
  const act = async (a: "toggle" | "next" | "previous") => { setMsg(""); const r = await spotifyControl(a); if (r !== "ok") setMsg(r); setTimeout(poll, 400); };
  const ctl = "grid h-9 w-9 place-items-center rounded-full text-fg hover:bg-raise";

  let body: React.ReactNode;
  if (!s) body = <p className="px-4 pb-4 text-sm text-dim">Loading…</p>;
  else if (!s.configured) body = <p className="px-4 pb-4 text-sm text-mute">Control your music from here. <Link className="font-medium text-accent hover:underline" href="/settings">Set up Spotify</Link></p>;
  else if (!s.connected) body = <div className="px-4 pb-4"><a className="btn-primary" href="/api/spotify/login">Connect Spotify</a></div>;
  else if (s.error) body = <p className="px-4 pb-4 text-sm text-danger">{s.error}</p>;
  else if (!s.active) body = <p className="px-4 pb-4 text-sm text-mute">Nothing playing. Start Spotify on any device.</p>;
  else body = (
    <div className="px-4 pb-4">
      <div className="flex items-center gap-3">
        {s.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.image} alt="" className="h-14 w-14 rounded-lg shadow-sm" /> : <div className="grid h-14 w-14 place-items-center rounded-lg bg-raise"><Icon name="music" /></div>}
        <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold">{s.track}</div><div className="truncate text-[13px] text-mute">{s.artists}</div></div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full bg-fg/70" style={{ width: `${((s.progress ?? 0) / (s.duration || 1)) * 100}%` }} /></div>
      <div className="mt-1 flex justify-between text-[11px] text-dim"><span>{mmss(s.progress)}</span><span>{mmss(s.duration)}</span></div>
      <div className="mt-1 flex items-center justify-center gap-2">
        <button className={ctl} onClick={() => act("previous")} aria-label="Previous"><Icon name="prev" size={16} /></button>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-fg text-bg hover:opacity-90" onClick={() => act("toggle")} aria-label={s.playing ? "Pause" : "Play"}><Icon name={s.playing ? "pause" : "play"} size={16} /></button>
        <button className={ctl} onClick={() => act("next")} aria-label="Next"><Icon name="next" size={16} /></button>
      </div>
      {msg && <p className="mt-2 text-xs text-danger">{msg}</p>}
    </div>
  );
  return <Panel title="Now playing" i={i} right={s?.connected && s.active ? <span>{s.device}</span> : null}>{body}</Panel>;
}
