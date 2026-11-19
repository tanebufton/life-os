// Minimal S3-compatible stub (path-style) with fault injection via /__mode?m=ok|corrupt|deny|nobucket
import http from "node:http";
const store = new Map(); let mode = "ok";
const xml = (s) => `<?xml version="1.0" encoding="UTF-8"?>${s}`;
const err = (res, code, name, msg) => { res.writeHead(code, { "content-type": "application/xml" }); res.end(xml(`<Error><Code>${name}</Code><Message>${msg}</Message></Error>`)); };
http.createServer((req, res) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => {
  const u = new URL(req.url, "http://x"); if (u.pathname === "/__mode") { mode = u.searchParams.get("m"); return res.end("ok " + mode); } if (u.pathname === "/__count") return res.end(String(store.size));
  if (mode === "deny") return err(res, 403, "AccessDenied", "Access Denied"); if (mode === "nobucket") return err(res, 404, "NoSuchBucket", "The specified bucket does not exist");
  const parts = u.pathname.split("/").filter(Boolean), bucket = parts[0], key = decodeURIComponent(parts.slice(1).join("/"));
  if (req.method === "GET" && !key) { const prefix = u.searchParams.get("prefix") ?? ""; const items = [...store.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => `<Contents><Key>${k}</Key><LastModified>${v.at}</LastModified><Size>${v.body.length}</Size></Contents>`).join(""); res.writeHead(200, { "content-type": "application/xml" }); return res.end(xml(`<ListBucketResult><Name>${bucket}</Name><IsTruncated>false</IsTruncated><KeyCount>${store.size}</KeyCount>${items}</ListBucketResult>`)); }
  if (req.method === "PUT") { let body = Buffer.concat(chunks); const meta = {}; for (const [h, v] of Object.entries(req.headers)) if (h.startsWith("x-amz-meta-")) meta[h] = v; store.set(key, { body, meta, at: new Date().toISOString() }); res.writeHead(200, { etag: '"x"' }); return res.end(); }
  if (req.method === "GET") { const o = store.get(key); if (!o) return err(res, 404, "NoSuchKey", "nope"); let b = o.body; if (mode === "corrupt" && b.length > 100) { b = Buffer.from(b); b[60] ^= 0xff; } res.writeHead(200, { "content-length": b.length, ...o.meta }); return res.end(b); }
  if (req.method === "DELETE") { store.delete(key); res.writeHead(204); return res.end(); }
  res.writeHead(405); res.end(); }); }).listen(4600);
