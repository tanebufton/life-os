"use server";
import { revalidatePath } from "next/cache";
import * as B from "./backup";
import { setSetting } from "./settings";

const okv = <T extends object>(v: T) => ({ ok: true as const, ...v });
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e), step: e instanceof B.BackupError ? e.step : undefined });
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const refresh = () => revalidatePath("/settings");

/** Blank secret fields keep what's already saved. */
export async function backupSave(fd: FormData) {
  try {
    for (const k of ["endpoint", "bucket", "key_id", "prefix"]) if (fd.has(k)) setSetting(`backup_${k}`, s(fd, k) || null);
    for (const k of ["secret", "passphrase"]) if (s(fd, k)) setSetting(`backup_${k}`, s(fd, k));
    const keep = Number(s(fd, "keep")), hours = Number(s(fd, "hours")); if (keep >= 1 && keep <= 365) setSetting("backup_keep", String(Math.floor(keep))); if (hours >= 1 && hours <= 720) setSetting("backup_hours", String(Math.floor(hours)));
    refresh(); return okv({ message: "Saved." });
  } catch (e) { return fail(e); }
}
export async function backupTest() { try { return okv({ message: await B.testConnection() }); } catch (e) { return fail(e); } }
/** The "migration": first run proves the whole round trip (encrypt, upload, download, decrypt, check) before anything is trusted. */
export async function backupNow() { try { const r = await B.runBackup(); refresh(); return okv({ message: `Backed up ${r.rows} rows (${(r.size / 1024).toFixed(0)} KB).`, steps: r.steps }); } catch (e) { refresh(); return fail(e); } }
export async function backupEnable(on: boolean) { if (on && !B.configured()) return fail(new B.BackupError("config", `Still needed: ${B.missing().join(", ")}.`)); setSetting("backup_enabled", on ? "1" : "0"); refresh(); return okv({ message: on ? "Automatic backups on." : "Automatic backups off." }); }
export async function backupList() { try { return okv({ items: await B.list(), safety: B.preRestoreFiles() }); } catch (e) { return fail(e); } }
export async function backupVerify(key: string) { try { const v = await B.fetchVerified(key); (await import("node:fs")).rmSync(v.file, { force: true }); return okv({ message: `Verified: decrypts, passes the database integrity check, ${v.check.rows} rows in ${v.check.tables} tables. The live data was not touched.` }); } catch (e) { return fail(e); } }
export async function backupRestore(key: string) { try { const r = await B.restore(key); revalidatePath("/", "layout"); return okv({ message: `Restored ${r.rows} rows. Your previous data was saved as ${r.safety} and can be put back with Undo.`, safety: r.safety }); } catch (e) { return fail(e); } }
export async function backupUndo(file: string) { try { const r = B.undoRestore(file); revalidatePath("/", "layout"); return okv({ message: `Put back ${r.rows} rows from before the restore.` }); } catch (e) { return fail(e); } }
