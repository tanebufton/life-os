// Next.js checks that Server Action requests come from the same origin. Behind a tunnel/proxy the public hostname must be allowed.
const base = process.env.LIFEOS_BASE_URL;
const allowed = [];
try { if (base) allowed.push(new URL(base).host); } catch { /* ignore a malformed value */ }
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" }, // keeps secret URLs (calendar feed etc.) out of Referer headers
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" }, // microphone only for voice memos
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }, // allows the re-login popup
];
export default {
  async headers() { return [{ source: "/:path*", headers: securityHeaders }]; },
  serverExternalPackages: ["better-sqlite3", "node-ical", "imapflow", "mailparser"],
  ...(allowed.length ? { experimental: { serverActions: { allowedOrigins: allowed } } } : {}),
};
