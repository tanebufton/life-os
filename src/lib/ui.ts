// Pure presentation helpers (safe on server and client).
const HUES = ["120 119 116", "217 115 13", "203 145 47", "68 131 97", "51 126 169", "144 101 176", "193 76 138", "212 76 71", "159 107 83"];
export function hue(name: string): string {
  let h = 0; for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}
export const projectKey = (name?: string | null) => (name ? name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() : "") || "TASK";
export const issueKey = (name: string | null | undefined, id: number) => `${projectKey(name)}-${id}`;
export const initial = (s: string) => (s.trim()[0] ?? "?").toUpperCase();
const URL_RE = /https?:\/\/[^\s<>"')]+/i;
export const firstUrl = (...texts: (string | null | undefined)[]): string | null => { for (const t of texts) { const m = t?.match(URL_RE); if (m) return m[0].replace(/[.,;:!?]+$/, ""); } return null; };
export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
