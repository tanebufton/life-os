/** Anything fetched server-side from a URL you gave us (calendar feeds) must be a public http(s) host, never your own network. */
export function assertPublicUrl(raw: string): URL {
  const u = new URL(raw);
  const h = u.hostname.toLowerCase();
  const bad = !["http:", "https:"].includes(u.protocol) || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") ||
    h.includes(":") || /^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  if (bad) throw new Error("The URL must be a public http(s) address");
  return u;
}
