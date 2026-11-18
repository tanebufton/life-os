import { getSetting, setSetting } from "./settings";

export const SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing";
const id = () => process.env.SPOTIFY_CLIENT_ID, secret = () => process.env.SPOTIFY_CLIENT_SECRET;
export const spotifyConfigured = () => Boolean(id() && secret());
export const spotifyConnected = () => Boolean(getSetting("spotify_refresh"));
export const redirectUri = () => `${(process.env.LIFEOS_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")}/api/spotify/callback`;

async function tokenRequest(body: Record<string, string>) {
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST", signal: AbortSignal.timeout(8000),
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: "Basic " + Buffer.from(`${id()}:${secret()}`).toString("base64") },
    body: new URLSearchParams(body),
  });
  if (!r.ok) throw new Error(`Spotify token error ${r.status}`);
  return r.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}
function store(j: { access_token: string; refresh_token?: string; expires_in: number }) {
  setSetting("spotify_access", j.access_token);
  setSetting("spotify_expires", String(Date.now() + (j.expires_in - 60) * 1000));
  if (j.refresh_token) setSetting("spotify_refresh", j.refresh_token);
}
export async function exchangeCode(code: string) {
  store(await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() }));
}
export function disconnectSpotify() { for (const k of ["spotify_access", "spotify_refresh", "spotify_expires"]) setSetting(k, null); }

async function accessToken(): Promise<string> {
  const refresh = getSetting("spotify_refresh");
  if (!refresh) throw new Error("Spotify not connected");
  if (Number(getSetting("spotify_expires") ?? 0) > Date.now()) return getSetting("spotify_access")!;
  store(await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh }));
  return getSetting("spotify_access")!;
}
async function api(method: string, path: string, query?: Record<string, string>) {
  const url = `https://api.spotify.com/v1${path}${query ? "?" + new URLSearchParams(query) : ""}`;
  return fetch(url, { method, headers: { authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(8000) });
}

export type Now = {
  configured: boolean; connected: boolean; active?: boolean; playing?: boolean; error?: string;
  track?: string; artists?: string; album?: string; image?: string; progress?: number; duration?: number; device?: string; volume?: number | null;
};
export async function nowPlaying(): Promise<Now> {
  if (!spotifyConfigured()) return { configured: false, connected: false };
  if (!spotifyConnected()) return { configured: true, connected: false };
  try {
    const r = await api("GET", "/me/player");
    if (r.status === 204) return { configured: true, connected: true, active: false };
    if (!r.ok) return { configured: true, connected: true, error: `Spotify ${r.status}` };
    const j: any = await r.json();
    const t = j.item;
    return {
      configured: true, connected: true, active: true, playing: j.is_playing, device: j.device?.name, volume: j.device?.volume_percent ?? null,
      track: t?.name, artists: t?.artists?.map((a: any) => a.name).join(", ") ?? t?.show?.name, album: t?.album?.name,
      image: t?.album?.images?.[1]?.url ?? t?.album?.images?.[0]?.url, progress: j.progress_ms, duration: t?.duration_ms,
    };
  } catch (e) { return { configured: true, connected: true, error: (e as Error).message }; }
}

export type Action = "play" | "pause" | "toggle" | "next" | "previous";
export async function control(action: Action, volume?: number): Promise<string> {
  let a = action;
  if (a === "toggle") a = (await nowPlaying()).playing ? "pause" : "play";
  const r = a === "play" ? await api("PUT", "/me/player/play") : a === "pause" ? await api("PUT", "/me/player/pause")
    : a === "next" ? await api("POST", "/me/player/next") : await api("POST", "/me/player/previous");
  if (volume !== undefined) await api("PUT", "/me/player/volume", { volume_percent: String(Math.max(0, Math.min(100, volume))) });
  if (r.ok) return "ok";
  if (r.status === 404) return "No active Spotify device. Open Spotify on a phone or computer first.";
  if (r.status === 403) return "Spotify refused: playback control needs Premium (or the action isn't allowed right now).";
  return `Spotify error ${r.status}`;
}
