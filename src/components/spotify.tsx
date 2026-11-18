"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { spotifyControl } from "@/lib/actions";
import type { Now } from "@/lib/spotify";
import { card } from "./ui";

const mmss = (ms = 0) => `${Math.floor(ms / 60000)}:${Math.floor((ms % 60000) / 1000).toString().padStart(2, "0")}`;

export function SpotifyWidget() {
  const [s, setS] = useState<Now | null>(null);
  const [msg, setMsg] = useState("");
  const poll = useCallback(async () => {
    try { setS(await (await fetch("/api/spotify/now", { cache: "no-store" })).json()); } catch {}
  }, []);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>, dead = false;
    const loop = async () => { await poll(); if (!dead) t = setTimeout(loop, document.hidden ? 30_000 : 5_000); };
    void loop(); return () => { dead = true; clearTimeout(t); };
  }, [poll]);
  const act = async (a: "toggle" | "next" | "previous") => {
    setMsg(""); const r = await spotifyControl(a); if (r !== "ok") setMsg(r);
    setTimeout(poll, 400);
  };

  let body: React.ReactNode;
  if (!s) body = <p className="text-sm text-neutral-500">Loading…</p>;
  else if (!s.configured) body = <p className="text-sm text-neutral-500">Add Spotify credentials to enable. <Link className="text-indigo-600 underline dark:text-indigo-400" href="/settings">Setup</Link></p>;
  else if (!s.connected) body = <a className="text-sm text-indigo-600 underline dark:text-indigo-400" href="/api/spotify/login">Connect Spotify</a>;
  else if (s.error) body = <p className="text-sm text-red-500">{s.error}</p>;
  else if (!s.active) body = <p className="text-sm text-neutral-500">Nothing playing. Start Spotify on any device.</p>;
  else body = (
    <div className="flex items-center gap-3">
      {s.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.image} alt="" className="h-16 w-16 rounded-md" />}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{s.track}</div>
        <div className="truncate text-sm text-neutral-500">{s.artists}</div>
        <div className="mt-1 h-1 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-700"><div className="h-full bg-green-500" style={{ width: `${((s.progress ?? 0) / (s.duration || 1)) * 100}%` }} /></div>
        <div className="mt-0.5 flex justify-between text-xs text-neutral-500"><span>{mmss(s.progress)}</span><span>{s.device}</span><span>{mmss(s.duration)}</span></div>
      </div>
    </div>
  );

  return (
    <div className={card}>
      <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Music</h2>
        {s?.connected && s.active && (
          <div className="flex gap-1 text-lg">
            <button onClick={() => act("previous")} aria-label="Previous" className="rounded px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">⏮</button>
            <button onClick={() => act("toggle")} aria-label={s.playing ? "Pause" : "Play"} className="rounded px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">{s.playing ? "⏸" : "▶️"}</button>
            <button onClick={() => act("next")} aria-label="Next" className="rounded px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">⏭</button>
          </div>)}
      </div>
      {body}
      {msg && <p className="mt-2 text-xs text-red-500">{msg}</p>}
    </div>
  );
}
