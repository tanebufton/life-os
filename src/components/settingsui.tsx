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
const AREA_LABEL: Record<string, string> = { tasks: "Tasks, search, brief", habits: "Habits", journal: "Journal", money: "Budget & transactions", subscriptions: "Subscriptions", voice: "Voice memos" };
type TokenItem = { id: number; name: string; prefix: string; created_at: string; last_used_at: string | null; level: string; areas: string | null; expires_at: string | null };
export function TokenManager({ tokens }: { tokens: TokenItem[] }) {
  const [name, setName] = useState(""), [level, setLevel] = useState<"read" | "write">("write"), [days, setDays] = useState(0), [areas, setAreas] = useState<string[]>([]), [fresh, setFresh] = useState<string | null>(null), [, start] = useTransition();
  const toggle = (a: string) => setAreas((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]));
  const desc = (t: TokenItem) => { const ar = t.areas ? (JSON.parse(t.areas) as string[]).map((a) => AREA_LABEL[a]?.split(",")[0] ?? a).join(", ") : "everything"; const exp = t.expires_at ? (Date.parse(t.expires_at) <= Date.now() ? "expired" : `expires ${t.expires_at.slice(0, 10)}`) : "no expiry"; return `${t.level === "read" ? "read-only" : "read & write"} · ${ar} · ${exp}`; };
  return (
    <div>
      {fresh && (<div className="m-4 rounded-lg border border-ok/40 bg-ok/10 p-3"><p className="mb-2 text-[13px] font-medium">Copy your token now. It won&apos;t be shown again.</p><CopyBox value={fresh} /></div>)}
      <ul>{tokens.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
          <div className="min-w-0"><div className="truncate font-medium">{t.name}</div><div className="text-xs text-dim"><code>{t.prefix}…</code> · {t.last_used_at ? `used ${t.last_used_at.slice(0, 10)}` : "never used"}</div><div className={`text-xs ${t.expires_at && Date.parse(t.expires_at) <= Date.now() ? "text-danger" : "text-mute"}`}>{desc(t)}</div></div>
          <button onClick={() => start(async () => { await revokeTokenAction(t.id); toast("Token revoked"); })} className="btn !h-7 text-xs text-danger">Revoke</button></li>))}
        {!tokens.length && <li className="px-4 py-3 text-sm text-mute">No tokens yet.</li>}</ul>
      <form className="space-y-3 border-t p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { setFresh(await createTokenAction(name || "token", { level, areas, days })); setName(""); }); }}>
        <div className="flex flex-wrap gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name, e.g. iOS Shortcut" aria-label="Token name" className="field !w-auto min-w-48 flex-1" />
          <select value={level} onChange={(e) => setLevel(e.target.value as "read" | "write")} aria-label="Access" className="field !w-40"><option value="write">Read &amp; write</option><option value="read">Read-only</option></select>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Expiry" className="field !w-40"><option value={0}>No expiry</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>1 year</option></select></div>
        <fieldset className="text-[13px]"><legend className="mb-1 text-xs text-mute">Limit to (leave all unticked for everything)</legend><div className="flex flex-wrap gap-x-4 gap-y-1">{Object.entries(AREA_LABEL).map(([k, v]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={areas.includes(k)} onChange={() => toggle(k)} />{v}</label>)}</div></fieldset>
        <button className="btn-primary">Create token</button>
        <p className="text-xs text-dim">Give each device or bot its own token with the least access it needs. A leaked token can then be revoked without affecting the others.</p></form>
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

import { telegramSetMode, telegramTest } from "@/lib/actions3";
export function TelegramButtons({ origin, mode }: { origin: string; mode: "polling" | "webhook" }) {
  const [msg, setMsg] = useState(""), [busy, start] = useTransition();
  const run = (f: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => { const r = await f(); setMsg(r.ok ? (r.message ?? "Done") : (r.error ?? "Failed")); });
  return (
    <div className="space-y-2">
      <div className="text-[13px] font-medium">How Telegram reaches LifeOS</div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={mode === "polling" ? "btn-primary" : "btn"} disabled={busy} onClick={() => run(() => telegramSetMode("polling", origin) as never)}>Polling (recommended)</button>
        <button type="button" className={mode === "webhook" ? "btn-primary" : "btn"} disabled={busy} onClick={() => run(() => telegramSetMode("webhook", origin) as never)}>Webhook</button>
        <button type="button" className="btn" disabled={busy} onClick={() => run(() => telegramTest() as never)}>Send test</button>
      </div>
      <p className="text-xs text-mute">{mode === "polling" ? "The worker asks Telegram for new messages, so LifeOS needs no public address for the bot. Requires the worker to be running." : "Telegram calls a public URL on your server, which you must leave open in Cloudflare Access (Bypass). Polling avoids this."}</p>
      {msg && <p className="text-[13px] text-mute">{msg}</p>}
    </div>
  );
}
