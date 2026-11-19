// Encrypted snapshots of the SQLite database to S3-compatible storage (built for Cloudflare R2).
// The local file stays the live database. A backup is only reported as successful after it has been
// downloaded again, decrypted and checked, so a failed run never leaves a bad "latest" backup behind.
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { db, dbFile } from "./db";
import { ensureDefaultStatuses } from "./statuses";
import { getSetting, setSetting } from "./settings";

export class BackupError extends Error { constructor(public step: string, message: string) { super(message); } }
const MAGIC = Buffer.from("LOSB1");
const env = (k: string) => process.env[`LIFEOS_BACKUP_${k}`];

export type Config = { endpoint: string; bucket: string; keyId: string; secret: string; passphrase: string; prefix: string; keep: number; hours: number; enabled: boolean };
export function config(): Config {
  const s = (k: string) => getSetting(`backup_${k}`) ?? "";
  const ep = env("ENDPOINT") || s("endpoint");
  return {
    endpoint: /^https?:\/\//.test(ep) ? ep.replace(/\/$/, "") : ep ? `https://${ep}.r2.cloudflarestorage.com` : "",
    bucket: env("BUCKET") || s("bucket"), keyId: env("KEY_ID") || s("key_id"), secret: env("SECRET") || s("secret"), passphrase: env("PASSPHRASE") || s("passphrase"),
    prefix: (env("PREFIX") || s("prefix") || "lifeos").replace(/^\/+|\/+$/g, ""), keep: Math.max(1, Number(s("keep")) || 14), hours: Math.max(1, Number(s("hours")) || 24), enabled: s("enabled") === "1",
  };
}
export const configured = (c = config()) => !!(c.endpoint && c.bucket && c.keyId && c.secret && c.passphrase);
export const missing = (c = config()) => [!c.endpoint && "account ID", !c.bucket && "bucket", !c.keyId && "access key ID", !c.secret && "secret access key", !c.passphrase && "passphrase"].filter(Boolean) as string[];

const client = (c = config()) => new S3Client({
  region: "auto", endpoint: c.endpoint, forcePathStyle: true, credentials: { accessKeyId: c.keyId, secretAccessKey: c.secret }, maxAttempts: 3,
  // R2 rejects the SDK's newer default checksum trailers; only send them when an operation requires it.
  requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
});
/** Turn raw SDK errors into something a person can act on. */
function explain(e: unknown): string {
  const x = e as { name?: string; message?: string; code?: string; $metadata?: { httpStatusCode?: number } };
  const n = x.name ?? "", st = x.$metadata?.httpStatusCode;
  if (n === "NoSuchBucket") return "That bucket doesn't exist. Check the bucket name.";
  if (n === "InvalidAccessKeyId" || n === "SignatureDoesNotMatch") return "R2 rejected the keys. Check the access key ID and secret.";
  if (n === "AccessDenied" || st === 403) return "Access denied. The API token needs Object Read & Write on this bucket.";
  if (n === "NoSuchKey" || st === 404) return "That backup no longer exists in the bucket.";
  if (x.code === "ENOTFOUND" || x.code === "ECONNREFUSED" || /ENOTFOUND|ECONNREFUSED|fetch failed/.test(x.message ?? "")) return "Couldn't reach the storage endpoint. Check the account ID and your network.";
  return x.message || n || "Unknown storage error";
}

// ---- encryption: gzip, then AES-256-GCM with a key derived (scrypt) from the passphrase. Layout: MAGIC | salt(16) | iv(12) | ciphertext | tag(16)
export function seal(plain: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), key = crypto.scryptSync(passphrase, salt, 32);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv), body = Buffer.concat([c.update(zlib.gzipSync(plain)), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, body, c.getAuthTag()]);
}
export function open(blob: Buffer, passphrase: string): Buffer {
  if (blob.length < MAGIC.length + 44 || !blob.subarray(0, MAGIC.length).equals(MAGIC)) throw new BackupError("decrypt", "That file isn't a LifeOS backup.");
  const salt = blob.subarray(5, 21), iv = blob.subarray(21, 33), tag = blob.subarray(blob.length - 16), body = blob.subarray(33, blob.length - 16);
  try { const d = crypto.createDecipheriv("aes-256-gcm", crypto.scryptSync(passphrase, salt, 32), iv); d.setAuthTag(tag); return zlib.gunzipSync(Buffer.concat([d.update(body), d.final()])); }
  catch { throw new BackupError("decrypt", "Couldn't decrypt. Wrong passphrase, or the backup is damaged."); }
}

// ---- snapshots
const sha = (b: Buffer | string) => crypto.createHash("sha256").update(b).digest("hex");
const tmpFile = (tag: string) => path.join(os.tmpdir(), `lifeos-${tag}-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.db`);
const rm = (f: string) => { for (const x of ["", "-wal", "-shm"]) try { fs.unlinkSync(f + x); } catch { /* already gone */ } };
export type Check = { rows: number; tables: number; hash: string };
/** Integrity-check a database file and fingerprint its contents (table names and row counts). */
export function inspect(file: string): Check {
  const d = new Database(file, { readonly: true });
  try {
    const ic = d.pragma("integrity_check", { simple: true }); if (ic !== "ok") throw new BackupError("integrity", `Database failed its integrity check: ${String(ic)}`);
    const names = (d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
    let rows = 0; const lines = names.map((n) => { const c = (d.prepare(`SELECT count(*) c FROM "${n}"`).get() as { c: number }).c; rows += c; return `${n}:${c}`; });
    return { rows, tables: names.length, hash: sha(lines.join("\n")) };
  } finally { d.close(); }
}
/** A consistent copy of the live database (safe while the app and worker are writing). */
export function snapshot(file = tmpFile("snap")): { file: string } & Check { db.prepare("VACUUM INTO ?").run(file); return { file, ...inspect(file) }; }

// ---- status
export type Status = { lastOk: string | null; lastError: string | null; lastKey: string | null };
export const status = (): Status => ({ lastOk: getSetting("backup_last_ok") ?? null, lastError: getSetting("backup_last_error") ?? null, lastKey: getSetting("backup_last_key") ?? null });
export type Item = { key: string; size: number; at: string };
export async function list(c = config()): Promise<Item[]> {
  try {
    const out: Item[] = []; let token: string | undefined;
    do { const r = await client(c).send(new ListObjectsV2Command({ Bucket: c.bucket, Prefix: c.prefix + "/lifeos-", ContinuationToken: token })); for (const o of r.Contents ?? []) if (o.Key?.endsWith(".db.enc")) out.push({ key: o.Key, size: o.Size ?? 0, at: o.LastModified?.toISOString() ?? "" }); token = r.NextContinuationToken; } while (token);
    return out.sort((a, b) => b.key.localeCompare(a.key));
  } catch (e) { throw new BackupError("list", explain(e)); }
}
export async function testConnection(c = config()): Promise<string> {
  const m = missing(c); if (m.length) throw new BackupError("config", `Still needed: ${m.join(", ")}.`);
  const key = `${c.prefix}/.lifeos-write-test`, body = Buffer.from(`ok ${Date.now()}`), s3 = client(c);
  try {
    await s3.send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: body }));
    const got = await s3.send(new GetObjectCommand({ Bucket: c.bucket, Key: key })); if (Buffer.from(await got.Body!.transformToByteArray()).toString() !== body.toString()) throw new Error("Read back different data than was written");
    await s3.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
  } catch (e) { throw new BackupError("connect", explain(e)); }
  return "Connected. Can write, read and delete in the bucket.";
}

async function download(key: string, c: Config): Promise<{ blob: Buffer; meta: Record<string, string> }> {
  try { const r = await client(c).send(new GetObjectCommand({ Bucket: c.bucket, Key: key })); return { blob: Buffer.from(await r.Body!.transformToByteArray()), meta: r.Metadata ?? {} }; }
  catch (e) { throw new BackupError("download", explain(e)); }
}
/** Download, decrypt and fully check a backup without touching the live database. Returns the decrypted file (caller deletes it). */
export async function fetchVerified(key: string, c = config()): Promise<{ file: string; check: Check; created: string }> {
  const { blob, meta } = await download(key, c), plain = open(blob, c.passphrase);
  if (meta.sha256 && sha(plain) !== meta.sha256) throw new BackupError("verify", "The downloaded backup doesn't match its recorded checksum.");
  const file = tmpFile("restore"); fs.writeFileSync(file, plain);
  try { const check = inspect(file); if (meta.counts && check.hash !== meta.counts) throw new BackupError("verify", "Row counts in the backup don't match what was recorded."); return { file, check, created: meta.created ?? "" }; }
  catch (e) { rm(file); throw e; }
}

let running = false;
/** Snapshot, encrypt, upload, then download and verify. Only then is it recorded as successful and old backups pruned. */
export async function runBackup(): Promise<{ key: string; size: number; rows: number; tables: number; steps: string[] }> {
  if (running) throw new BackupError("busy", "A backup is already running.");
  running = true; const c = config(), steps: string[] = []; let snap: string | null = null, key = "", uploaded = false;
  try {
    const m = missing(c); if (m.length) throw new BackupError("config", `Backup isn't set up yet. Still needed: ${m.join(", ")}.`);
    const s = snapshot(); snap = s.file; steps.push(`Snapshot taken and integrity-checked (${s.rows} rows in ${s.tables} tables)`);
    const plain = fs.readFileSync(snap), blob = seal(plain, c.passphrase), created = new Date().toISOString();
    key = `${c.prefix}/lifeos-${created.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${sha(plain).slice(0, 8)}.db.enc`;
    try { await client(c).send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: blob, Metadata: { sha256: sha(plain), counts: s.hash, rows: String(s.rows), created } })); uploaded = true; }
    catch (e) { throw new BackupError("upload", explain(e)); }
    steps.push(`Encrypted and uploaded (${(blob.length / 1024).toFixed(0)} KB)`);
    const v = await fetchVerified(key, c); rm(v.file);
    if (v.check.hash !== s.hash) throw new BackupError("verify", "The uploaded copy doesn't match the snapshot.");
    steps.push("Downloaded again, decrypted and verified against the snapshot");
    const all = await list(c), old = all.slice(c.keep);
    for (const o of old) { try { await client(c).send(new DeleteObjectCommand({ Bucket: c.bucket, Key: o.key })); } catch { /* pruning is best effort */ } }
    if (old.length) steps.push(`Removed ${old.length} older backup${old.length === 1 ? "" : "s"} (keeping ${c.keep})`);
    setSetting("backup_last_ok", created); setSetting("backup_last_key", key); setSetting("backup_last_error", null);
    return { key, size: blob.length, rows: s.rows, tables: s.tables, steps };
  } catch (e) {
    if (uploaded && e instanceof BackupError && ["verify", "decrypt", "integrity"].includes(e.step)) { try { await client(c).send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key })); } catch { /* leave it */ } }
    const be = e instanceof BackupError ? e : new BackupError("backup", (e as Error).message);
    setSetting("backup_last_error", `${be.step}: ${be.message}`); throw be;
  } finally { if (snap) rm(snap); running = false; }
}

// ---- restore. The swap happens inside one SQLite transaction, so a failure part-way rolls back completely.
const KEEP_SETTINGS = /^backup_/;
function applyFile(file: string) {
  const names = (d: { prepare: typeof db.prepare }) => (d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((t) => t.name);
  const keep = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'backup\\_%' ESCAPE '\\'").all() as { key: string; value: string }[];
  db.pragma("foreign_keys = OFF"); db.prepare("ATTACH DATABASE ? AS r").run(file);
  try {
    const live = names(db), cols = (schema: string, t: string) => (db.prepare(`PRAGMA ${schema}.table_info("${t}")`).all() as { name: string }[]).map((c) => c.name);
    const inBackup = new Set((db.prepare("SELECT name FROM r.sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name));
    db.transaction(() => {
      for (const t of live) {
        db.exec(`DELETE FROM main."${t}"`);
        if (!inBackup.has(t)) continue;
        const rc = new Set(cols("r", t)), shared = cols("main", t).filter((c) => rc.has(c)).map((c) => `"${c}"`).join(",");
        if (shared) db.exec(`INSERT INTO main."${t}" (${shared}) SELECT ${shared} FROM r."${t}"`);
      }
      ensureDefaultStatuses(); // a backup from before board columns existed has no statuses table
      db.prepare("UPDATE tasks SET status=CASE WHEN done_at IS NOT NULL THEN 'done' ELSE 'todo' END WHERE status NOT IN (SELECT key FROM statuses)").run(); // tasks pointing at a column that no longer exists
      const bad = db.pragma("foreign_key_check") as unknown[]; if (bad.length) throw new BackupError("restore", `Restored data has ${bad.length} broken references; nothing was changed.`);
      const ins = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
      for (const k of keep) if (KEEP_SETTINGS.test(k.key)) ins.run(k.key, k.value); // your current backup credentials survive a restore
    })();
  } finally { try { db.exec("DETACH DATABASE r"); } catch { /* not attached */ } db.pragma("foreign_keys = ON"); }
}
const preDir = () => path.dirname(dbFile);
export const preRestoreFiles = () => { try { return fs.readdirSync(preDir()).filter((f) => /^pre-restore-.*\.db$/.test(f)).sort().reverse(); } catch { return []; } };
/** Replace the live data with a backup. A safety copy of the current data is saved first so this can be undone. */
export async function restore(key: string): Promise<{ rows: number; safety: string }> {
  const v = await fetchVerified(key);
  try {
    const safety = `pre-restore-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${crypto.randomBytes(2).toString("hex")}.db`; snapshot(path.join(preDir(), safety));
    try { applyFile(v.file); } catch (e) { throw e instanceof BackupError ? e : new BackupError("restore", `Restore failed and was rolled back: ${(e as Error).message}`); }
    for (const old of preRestoreFiles().slice(3)) rm(path.join(preDir(), old));
    return { rows: v.check.rows, safety };
  } finally { rm(v.file); }
}
export function undoRestore(file: string): { rows: number } {
  if (!/^pre-restore-[\w-]+\.db$/.test(file)) throw new BackupError("restore", "Not a safety copy.");
  const f = path.join(preDir(), file); if (!fs.existsSync(f)) throw new BackupError("restore", "That safety copy no longer exists.");
  const check = inspect(f); try { applyFile(f); } catch (e) { throw e instanceof BackupError ? e : new BackupError("restore", `Undo failed and was rolled back: ${(e as Error).message}`); }
  return { rows: check.rows };
}

// ---- scheduling (called by the worker)
export const isDue = (now = Date.now()) => { const c = config(), s = status(); if (!c.enabled || !configured(c)) return false; const last = s.lastOk ? Date.parse(s.lastOk) : 0; return now - last >= c.hours * 3600_000 && now - (Number(getSetting("backup_last_try")) || 0) >= 3600_000; };
export async function backupIfDue(): Promise<{ ran: boolean; error?: string }> {
  if (!isDue()) return { ran: false };
  setSetting("backup_last_try", String(Date.now()));
  try { await runBackup(); return { ran: true }; } catch (e) { return { ran: true, error: (e as Error).message }; }
}
