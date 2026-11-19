// Starting several processes at once on a brand-new database must not fail ("duplicate column name").
import assert from "node:assert/strict"; import { spawn } from "node:child_process"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lifeos-init-")), db = path.join(dir, "fresh.db");
const run = () => new Promise<{ code: number | null; err: string }>((res) => { const p = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "tests/init-probe.mts"], { env: { ...process.env, LIFEOS_DB: db } }); let err = ""; p.stderr.on("data", (d) => (err += d)); p.on("close", (code) => res({ code, err })); });
const rs = await Promise.all(Array.from({ length: 8 }, run));
for (const [i, r] of rs.entries()) assert.equal(r.code, 0, `process ${i} failed: ${r.err.slice(0, 300)}`);
fs.rmSync(dir, { recursive: true, force: true }); console.log("  ✓ 8 simultaneous first starts on a fresh database all succeed\n\n1 checks passed");
