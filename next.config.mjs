// Next.js checks that Server Action requests come from the same origin. Behind a tunnel/proxy the public hostname must be allowed.
const base = process.env.LIFEOS_BASE_URL;
const allowed = [];
try { if (base) allowed.push(new URL(base).host); } catch { /* ignore a malformed value */ }
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" }, // browsers only honour this over https; no includeSubDomains, so other sites on the domain are unaffected
  { key: "Referrer-Policy", value: "no-referrer" }, // keeps secret URLs (calendar feed etc.) out of Referer headers
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" }, // microphone only for voice memos
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }, // allows the re-login popup
];
// The Docker build sets LIFEOS_FAST_BUILD: types are already checked by `npm test` / `tsc` before a commit, so the server doesn't repeat that slow step on every update.
// It also skips "Collecting build traces" (about a third of the build): those trace files are only read by `output: "standalone"` and hosted
// platforms, while the image runs `next start` with the full node_modules, so they were never used.
const fast = process.env.LIFEOS_FAST_BUILD === "1";
export default {
  ...(fast ? { typescript: { ignoreBuildErrors: true }, eslint: { ignoreDuringBuilds: true }, outputFileTracingExcludes: { "*": ["**/*"] } } : {}),
  async headers() { return [{ source: "/:path*", headers: securityHeaders }]; },
  serverExternalPackages: ["better-sqlite3", "node-ical", "imapflow", "mailparser"],
  experimental: { serverActions: { bodySizeLimit: "8mb", ...(allowed.length ? { allowedOrigins: allowed } : {}) } }, // imports upload files through server actions
};
