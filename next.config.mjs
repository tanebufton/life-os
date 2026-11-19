// Next.js checks that Server Action requests come from the same origin. Behind a tunnel/proxy the public hostname must be allowed.
const base = process.env.LIFEOS_BASE_URL;
const allowed = [];
try { if (base) allowed.push(new URL(base).host); } catch { /* ignore a malformed value */ }
export default {
  serverExternalPackages: ["better-sqlite3", "node-ical", "imapflow", "mailparser"],
  ...(allowed.length ? { experimental: { serverActions: { allowedOrigins: allowed } } } : {}),
};
