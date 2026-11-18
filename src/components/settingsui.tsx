"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTokenAction, regenerateIcal, regenerateInbound, revokeTokenAction, testNotification } from "@/lib/actions";
import { Icon } from "./Icon";

export function CopyBox({ value, mono = true }: { value: string; mono?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border bg-raise/60 pl-3">
      <code className={`min-w-0 flex-1 truncate py-2 text-xs ${mono ? "" : "font-sans"}`} title={value}>{value}</code>
      <button onClick={() => { void navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); }} className="grid h-8 w-8 shrink-0 place-items-center text-mute hover:text-fg" aria-label="Copy"><Icon name={ok ? "check" : "copy"} size={15} className={ok ? "text-ok" : ""} /></button>
    </div>
  );
}
export function TokenManager({ tokens }: { tokens: { id: number; name: string; prefix: string; created_at: string; last_used_at: string | null }[] }) {
  const [name, setName] = useState(""), [fresh, setFresh] = useState<string | null>(null), [, start] = useTransition();
  return (
    <div>
      {fresh && (<div className="m-4 rounded-lg border border-ok/40 bg-ok/10 p-3"><p className="mb-2 text-[13px] font-medium">Copy your token now. It won&apos;t be shown again.</p><CopyBox value={fresh} /></div>)}
      <ul>{tokens.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
          <div className="min-w-0"><div className="truncate font-medium">{t.name}</div><div className="text-xs text-dim"><code>{t.prefix}…</code> · {t.last_used_at ? `used ${t.last_used_at.slice(0, 10)}` : "never used"}</div></div>
          <button onClick={() => start(async () => { await revokeTokenAction(t.id); toast("Token revoked"); })} className="btn !h-7 text-xs text-danger">Revoke</button></li>))}
        {!tokens.length && <li className="px-4 py-3 text-sm text-mute">No tokens yet.</li>}</ul>
      <form className="flex gap-2 border-t p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { setFresh(await createTokenAction(name || "token")); setName(""); }); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name, e.g. iOS Shortcut" className="field" /><button className="btn-primary">Create token</button></form>
    </div>
  );
}
export function TestNotify() {
  const [msg, setMsg] = useState(""), [busy, start] = useTransition();
  return (<div className="flex items-center gap-3"><button type="button" className="btn" disabled={busy} onClick={() => start(async () => setMsg(await testNotification()))}><Icon name="bell" size={15} />Send test</button>{msg && <span className="text-[13px] text-mute">{msg}</span>}</div>);
}
export function RegenButton({ which }: { which: "ical" | "inbound" }) {
  const [, start] = useTransition();
  return <button className="btn !h-7 text-xs" onClick={() => { if (confirm("The old link will stop working. Continue?")) start(async () => { await (which === "ical" ? regenerateIcal() : regenerateInbound()); toast("New link generated"); }); }}>Regenerate</button>;
}
