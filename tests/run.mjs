// Runs every unit/integration test against a throwaway database. `npm test`
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lifeos-tests-"));
const stub = spawn(process.execPath, ["tests/s3stub.mjs"], { stdio: "ignore" }); // S3-compatible stand-in for the backup tests
await new Promise((r) => setTimeout(r, 700));
const files = fs.readdirSync("tests").filter((f) => f.endsWith(".test.mts")).sort();
let failed = 0;
for (const f of files) {
  const t0 = Date.now(), r = spawnSync("npx", ["tsx", path.join("tests", f)], { env: { ...process.env, LIFEOS_DB: path.join(tmp, f + ".db") }, encoding: "utf8", timeout: 240_000 });
  const out = (r.stdout ?? "") + (r.stderr ?? ""), summary = out.split("\n").filter((l) => /checks? passed|passed|failed/i.test(l)).pop()?.trim() ?? "";
  if (r.status === 0) console.log(`✓ ${f}  ${summary}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  else { failed++; console.log(`✗ ${f}\n${out.split("\n").slice(-25).join("\n")}`); }
}
stub.kill(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} test file(s) failed` : `\nAll ${files.length} test files passed`);
process.exit(failed ? 1 : 0);
