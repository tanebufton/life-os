"use client";
import { useEffect, useState, useTransition } from "react";
import { backupEnable, backupList, backupNow, backupRestore, backupSave, backupTest, backupUndo, backupVerify } from "@/lib/actions4";

type R = { ok: boolean; message?: string; error?: string; steps?: string[]; items?: { key: string; size: number; at: string }[]; safety?: string[] };
const when = (iso: string) => (iso ? new Date(iso).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" }) : "");
const nm = (k: string) => k.split("/").pop()!.replace(/^lifeos-/, "").replace(".db.enc", "");

export function BackupPanel({ init }: { init: { account: string; bucket: string; keyId: string; prefix: string; keep: number; hours: number; hasSecret: boolean; hasPass: boolean; configured: boolean; enabled: boolean; lastOk: string | null; lastError: string | null; fromEnv: boolean } }) {
  const [msg, setMsg] = useState<R | null>(null), [list, setList] = useState<R | null>(null), [busy, start] = useTransition(), [enabled, setEnabled] = useState(init.enabled), [which, setWhich] = useState("");
  const load = () => backupList().then((r) => setList(r as R));
  useEffect(() => { if (init.configured) void load(); }, [init.configured]);
  const run = (label: string, f: () => Promise<R>, after?: () => void) => start(async () => { setWhich(label); setMsg(null); const r = await f(); setMsg(r); setWhich(""); after?.(); });
  const Msg = () => msg && (
    <div role="status" className={`rounded-lg border px-3 py-2 text-[13px] ${msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-danger/30 bg-danger/10 text-danger"}`}>
      {msg.ok ? msg.message : msg.error}{msg.steps && <ul className="mt-1 list-disc pl-5 text-fg/80">{msg.steps.map((s) => <li key={s}>{s}</li>)}</ul>}
    </div>
  );
  return (
    <div className="space-y-4 p-4">
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run("save", () => backupSave(fd) as Promise<R>, () => location.reload()); }} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-[13px] font-medium">R2 account ID<input name="endpoint" defaultValue={init.account} placeholder="32-character ID from the R2 page" className="field font-normal" autoComplete="off" disabled={init.fromEnv} /></label>
          <label className="space-y-1.5 text-[13px] font-medium">Bucket<input name="bucket" defaultValue={init.bucket} placeholder="lifeos-backups" className="field font-normal" autoComplete="off" /></label>
          <label className="space-y-1.5 text-[13px] font-medium">Access key ID<input name="key_id" defaultValue={init.keyId} className="field font-normal" autoComplete="off" /></label>
          <label className="space-y-1.5 text-[13px] font-medium">Secret access key <span className="font-normal text-dim">{init.hasSecret ? "(saved)" : ""}</span><input name="secret" type="password" placeholder={init.hasSecret ? "••••••••" : ""} className="field font-normal" autoComplete="off" /></label>
        </div>
        <label className="block space-y-1.5 text-[13px] font-medium">Encryption passphrase <span className="font-normal text-dim">{init.hasPass ? "(saved)" : ""}</span><input name="passphrase" type="password" placeholder={init.hasPass ? "••••••••" : "Choose a long phrase"} className="field font-normal" autoComplete="off" />
          <span className="block text-xs font-normal text-warn">Write this down somewhere safe. Backups are encrypted with it before they leave this server, and without it they cannot be restored by anyone.</span></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-[13px] font-medium">Folder in bucket<input name="prefix" defaultValue={init.prefix} className="field font-normal" /></label>
          <label className="space-y-1.5 text-[13px] font-medium">Back up every (hours)<input name="hours" type="number" min={1} defaultValue={init.hours} className="field font-normal" /></label>
          <label className="space-y-1.5 text-[13px] font-medium">Keep last<input name="keep" type="number" min={1} defaultValue={init.keep} className="field font-normal" /></label>
        </div>
        <div className="flex flex-wrap gap-2"><button className="btn" disabled={busy}>{which === "save" ? "Saving…" : "Save"}</button><button type="button" className="btn" disabled={busy} onClick={() => run("test", backupTest as () => Promise<R>)}>{which === "test" ? "Testing…" : "Test connection"}</button></div>
      </form>
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <button className="btn-primary" disabled={busy || !init.configured} onClick={() => run("now", backupNow as () => Promise<R>, () => void load())}>{which === "now" ? "Backing up and verifying…" : "Back up now & verify"}</button>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => { const v = e.target.checked; run("enable", () => backupEnable(v) as Promise<R>, () => setEnabled((x) => (msg?.ok === false ? x : v))); setEnabled(v); }} />Back up automatically</label>
        <span className="text-xs text-mute">{init.lastOk ? `Last good backup ${when(init.lastOk)}` : "No backup yet"}</span>
      </div>
      {init.lastError && <p className="text-[13px] text-danger">Last attempt failed: {init.lastError}</p>}
      <Msg />
      {init.configured && (
        <div>
          <div className="mb-1 flex items-center justify-between text-[13px] font-medium"><span>Backups in R2</span><button className="text-xs font-normal text-mute hover:text-fg" onClick={() => void load()}>Refresh</button></div>
          {!list ? <p className="text-xs text-mute">Loading…</p> : !list.ok ? <p className="text-[13px] text-danger">{list.error}</p> : (
            <ul className="divide-y rounded-lg border">{(list.items ?? []).map((b) => (
              <li key={b.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]"><span className="min-w-0 flex-1 truncate tabular-nums">{when(b.at) || nm(b.key)}</span><span className="text-xs text-dim">{(b.size / 1024).toFixed(0)} KB</span>
                <button className="text-xs text-accent hover:underline" disabled={busy} onClick={() => run("v" + b.key, () => backupVerify(b.key) as Promise<R>)}>Verify</button>
                <button className="text-xs text-danger hover:underline" disabled={busy} onClick={() => { if (confirm(`Replace ALL current LifeOS data with the backup from ${when(b.at)}?\n\nYour current data is saved first, and you can undo this.`)) run("r" + b.key, () => backupRestore(b.key) as Promise<R>, () => void load()); }}>Restore</button></li>))}
              {!(list.items ?? []).length && <li className="px-3 py-4 text-center text-xs text-mute">None yet. Press “Back up now & verify”.</li>}</ul>)}
          {(list?.safety ?? []).length > 0 && <div className="mt-3 text-xs text-mute">Undo a restore: {(list?.safety ?? []).slice(0, 3).map((f) => <button key={f} className="mr-3 text-accent hover:underline" disabled={busy} onClick={() => { if (confirm("Put back the data you had before that restore?")) run("u" + f, () => backupUndo(f) as Promise<R>); }}>{f.replace("pre-restore-", "").replace(/\.db$/, "").replace(/-[0-9a-f]{4}$/, "")}</button>)}</div>}
        </div>
      )}
    </div>
  );
}
