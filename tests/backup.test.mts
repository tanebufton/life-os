import os from "node:os"; const TMP = os.tmpdir();
import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
const DB = TMP + "/bk.db"; for (const x of ["", "-wal", "-shm"]) fs.rmSync(DB + x, { force: true }); for (const f of fs.readdirSync(TMP)) if (f.startsWith("pre-restore-")) fs.rmSync(TMP + "/" + f);
process.env.LIFEOS_DB = DB; process.env.LIFEOS_BACKUP_ENDPOINT = "http://127.0.0.1:4600";
const B = await import("../src/lib/backup.ts"); const { db } = await import("../src/lib/db.ts"); const { setSetting, getSetting } = await import("../src/lib/settings.ts"); const T = await import("../src/lib/tasks.ts");
const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
let n = 0; const ok = (name: string) => { n++; console.log("  ✓", name); }; const mode = (m: string) => fetch("http://127.0.0.1:4600/__mode?m=" + m);
const rejects = async (f: () => Promise<unknown>, step: string, re: RegExp) => { try { await f(); assert.fail("expected failure: " + step); } catch (e: any) { assert.equal(e.step, step, `${step}: ${e.message}`); assert.match(e.message, re); } };
const titles = () => (db.prepare("SELECT title FROM tasks ORDER BY id").all() as any[]).map((r) => r.title);
T.createTask({ title: "Alpha" }); T.createTask({ title: "Beta" }); db.prepare("INSERT INTO projects (name) VALUES ('Proj')").run();

await rejects(() => B.runBackup(), "config", /Still needed/); assert.equal(B.status().lastOk, null); ok("not configured -> clear message, nothing recorded as success");
setSetting("backup_bucket", "bk"); setSetting("backup_key_id", "AKIA"); setSetting("backup_secret", "s3cr3t"); setSetting("backup_passphrase", "correct horse"); setSetting("backup_keep", "2");
assert.equal(B.configured(), true); assert.equal(B.config().endpoint, "http://127.0.0.1:4600");
assert.match(await B.testConnection(), /Connected/); ok("connection test writes, reads and deletes");
await mode("nobucket"); await rejects(() => B.testConnection(), "connect", /bucket doesn't exist/); await mode("deny"); await rejects(() => B.testConnection(), "connect", /Access denied/); await mode("ok"); ok("connection errors are explained (no bucket, access denied)");
setSetting("backup_endpoint", "abc123"); delete process.env.LIFEOS_BACKUP_ENDPOINT; assert.equal(B.config().endpoint, "https://abc123.r2.cloudflarestorage.com"); process.env.LIFEOS_BACKUP_ENDPOINT = "http://127.0.0.1:4600"; ok("account ID becomes the R2 endpoint");

const r1 = await B.runBackup(); assert.ok(r1.steps.length >= 3 && r1.rows > 0); const l1 = await B.list(); assert.equal(l1.length, 1); assert.ok(B.status().lastOk && !B.status().lastError); ok("backup: snapshot, upload, download-verify, recorded");
const raw = Buffer.from(await (await fetch("http://127.0.0.1:4600/bk/" + l1[0].key)).arrayBuffer()); assert.ok(!raw.includes("SQLite format") && !raw.includes("Alpha") && !raw.includes("s3cr3t")); ok("stored object is encrypted (no plaintext, no secrets)");
const sealed = B.seal(Buffer.from("hello"), "pw"); assert.equal(B.open(sealed, "pw").toString(), "hello"); assert.throws(() => B.open(sealed, "bad"), /Couldn't decrypt/); const tam = Buffer.from(sealed); tam[tam.length - 20] ^= 1; assert.throws(() => B.open(tam, "pw"), /Couldn't decrypt/); ok("crypto: roundtrip, wrong passphrase and tampering both rejected");
setSetting("backup_passphrase", "wrong"); await rejects(() => B.fetchVerified(l1[0].key), "decrypt", /Wrong passphrase/); setSetting("backup_passphrase", "correct horse"); ok("restore with wrong passphrase fails safely");

// restore + undo
const before = titles(); T.createTask({ title: "Gamma (after backup)" }); db.prepare("DELETE FROM tasks WHERE title='Alpha'").run(); setSetting("backup_secret", "rotated");
const rs = await B.restore(l1[0].key); assert.deepEqual(titles(), before); assert.equal(getSetting("backup_secret"), "rotated"); assert.ok(fs.existsSync(path.join(TMP, rs.safety))); ok("restore returns data to the backup; current backup credentials are kept; safety copy written");
B.undoRestore(rs.safety); assert.deepEqual(titles(), ["Beta", "Gamma (after backup)"]); ok("undo restore brings back the pre-restore state");
setSetting("backup_secret", "s3cr3t");

// failure modes
const lastOk = B.status().lastOk; await mode("corrupt"); await rejects(() => B.runBackup(), "decrypt", /damaged/); assert.equal(B.status().lastOk, lastOk); assert.match(B.status().lastError!, /^decrypt:/); await mode("ok"); assert.equal((await B.list()).length, 1); ok("corrupted upload: detected, reported, bad object removed, last good backup untouched");
await mode("deny"); await rejects(() => B.runBackup(), "upload", /Access denied/); await mode("ok"); assert.equal((await B.list()).length, 1); ok("denied upload: clear error, nothing partial left behind");
// broken-reference backup must roll back
const snap = B.snapshot(TMP + "/bad.db"); const Database = (await import("better-sqlite3")).default; const d = new Database(TMP + "/bad.db"); d.pragma("foreign_keys=OFF"); d.prepare("UPDATE tasks SET project_id=9999 WHERE id=(SELECT min(id) FROM tasks)").run(); d.close();
await new (S3Client as any)({ region: "auto", endpoint: "http://127.0.0.1:4600", forcePathStyle: true, credentials: { accessKeyId: "a", secretAccessKey: "b" }, requestChecksumCalculation: "WHEN_REQUIRED" }).send(new PutObjectCommand({ Bucket: "bk", Key: "lifeos/lifeos-99990101T000000Z-bad00000.db.enc", Body: B.seal(fs.readFileSync(TMP + "/bad.db"), "correct horse") }));
const live = titles(); await rejects(() => B.restore("lifeos/lifeos-99990101T000000Z-bad00000.db.enc"), "restore", /broken references/); assert.deepEqual(titles(), live); assert.equal(db.pragma("foreign_keys", { simple: true }), 1); ok("restore that would break references is rolled back; live data untouched; foreign keys back on");

// prune keeps newest N
fs.rmSync(TMP + "/bad.db"); await fetch("http://127.0.0.1:4600/__mode?m=ok");
await B.list().then(async (l) => { for (const i of l) await fetch("http://127.0.0.1:4600/bk/" + i.key, { method: "DELETE" }); });
for (let i = 0; i < 4; i++) { T.createTask({ title: "p" + i }); await B.runBackup(); await new Promise((r) => setTimeout(r, 1100)); }
assert.equal((await B.list()).length, 2); ok("pruning keeps the newest N (keep=2)");

// schedule
setSetting("backup_enabled", "1"); setSetting("backup_hours", "24"); setSetting("backup_last_try", null as any); assert.equal(B.isDue(Date.now()), false); assert.equal(B.isDue(Date.now() + 25 * 3600_000), true);
setSetting("backup_enabled", "0"); assert.equal(B.isDue(Date.now() + 99 * 3600_000), false); ok("scheduler: due only when enabled and the interval has passed");
console.log(`\n${n} checks passed`); process.exit(0);
