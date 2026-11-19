"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { contributeAction, deleteSubAction, deleteTxAction, importCsv, markPaidAction, previewCsv, setBudgetAction, setSubStatusAction, updateTxCategory } from "@/lib/actions";
import { fmtMoney } from "@/lib/moneyfmt";
import { Icon } from "./Icon";

export function BudgetCell({ id, month, budget, cur, isDefault }: { id: number; month: string; budget: number; cur: string; isDefault: boolean }) {
  const [edit, setEdit] = useState(false), [v, setV] = useState((budget / 100).toString()), [every, setEvery] = useState(isDefault), [, start] = useTransition();
  const save = () => { const n = Number(v); setEdit(false); if (Number.isFinite(n) && n >= 0 && Math.round(n * 100) !== budget) start(async () => { await setBudgetAction(id, month, n, every); toast(every ? "Budget updated for every month" : "Budget updated for this month"); }); };
  if (!edit) return <button onClick={() => setEdit(true)} className="rounded px-1.5 py-0.5 text-[13px] tabular-nums text-mute hover:bg-raise hover:text-fg" title="Edit budget">{budget ? fmtMoney(budget, cur, { compact: true }) : "Set budget"}</button>;
  return (
    <span className="flex items-center gap-1.5"><input autoFocus inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEdit(false); }} className="field !w-24 !py-1 text-right text-[13px]" aria-label="Budget amount" />
      <label className="flex items-center gap-1 text-[11px] text-mute"><input type="checkbox" checked={every} onChange={(e) => setEvery(e.target.checked)} />every month</label><button onClick={save} className="btn-primary !h-7 !px-2 text-xs">Save</button></span>
  );
}
export function TxCategory({ id, value, cats, payee }: { id: number; value: number | null; cats: { id: number; name: string }[]; payee: string }) {
  const [v, setV] = useState(value), [, start] = useTransition();
  return (
    <select value={v ?? ""} aria-label="Category" onChange={(e) => {
      const n = e.target.value ? Number(e.target.value) : null; setV(n);
      const rule = n && payee ? (confirm(`Always file “${payee}” under ${cats.find((c) => c.id === n)?.name}?`) ? payee : undefined) : undefined;
      start(async () => { await updateTxCategory(id, n, rule); if (rule) toast("Rule saved. Future matches are filed automatically."); });
    }} className="field !h-8 !w-auto !py-0 text-[13px]"><option value="">Uncategorised</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
  );
}
export function DeleteTx({ id }: { id: number }) { const [, start] = useTransition(); return <button onClick={() => start(async () => { await deleteTxAction(id); })} aria-label="Delete transaction" className="rounded p-1 text-dim opacity-0 hover:text-danger group-hover:opacity-100 [@media(hover:none)]:opacity-100"><Icon name="trash" size={14} /></button>; }

export function CsvImport({ cur }: { cur: string }) {
  const [text, setText] = useState(""), [dayFirst, setDayFirst] = useState(true), [invert, setInvert] = useState(false), [prev, setPrev] = useState<null | Awaited<ReturnType<typeof previewCsv>>>(null), [busy, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const run = (t = text, d = dayFirst, i = invert) => start(async () => setPrev(t.trim() ? await previewCsv(t, d, i) : null));
  return (
    <div className="space-y-3 p-4">
      <p className="text-[13px] text-mute">Export a CSV from your bank (or credit card) and drop it here. Columns are detected automatically; imports are de-duplicated, so re-uploading an overlapping statement is safe.</p>
      <div className="flex flex-wrap items-center gap-2"><input ref={file} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setText(t); run(t); } }} /><button className="btn" onClick={() => file.current?.click()}><Icon name="download" size={15} className="rotate-180" />Choose CSV file</button>
        <label className="flex items-center gap-1.5 text-[13px] text-mute"><input type="checkbox" checked={dayFirst} onChange={(e) => { setDayFirst(e.target.checked); run(text, e.target.checked, invert); }} />Day first (31/12/2026)</label>
        <label className="flex items-center gap-1.5 text-[13px] text-mute"><input type="checkbox" checked={invert} onChange={(e) => { setInvert(e.target.checked); run(text, dayFirst, e.target.checked); }} />Card statement (spending shown as positive)</label></div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setPrev(null); }} onBlur={() => run()} rows={4} placeholder="…or paste CSV text here" className="field font-mono text-xs" />
      {prev && (prev.count ? (
        <div className="rounded-lg border bg-raise/40 p-3 text-[13px]">
          <p className="mb-2 font-medium">{prev.count} transactions found{prev.skipped ? <span className="font-normal text-mute"> · {prev.skipped} rows skipped</span> : null} <span className="font-normal text-dim">(columns: {Object.values(prev.columns).filter(Boolean).join(", ")})</span></p>
          <ul className="mb-3 space-y-0.5 text-xs">{prev.sample.map((r, i) => <li key={i} className="flex justify-between gap-3"><span className="text-mute">{r.date}</span><span className="min-w-0 flex-1 truncate">{r.payee || "(no description)"}</span><span className="tabular-nums">{fmtMoney(r.amount_cents, cur)}</span></li>)}</ul>
          <button className="btn-primary" disabled={busy} onClick={() => start(async () => { const r = await importCsv(text, dayFirst, invert); setPrev(null); setText(""); toast.success(`Imported ${r.imported}${r.duplicates ? ` · ${r.duplicates} duplicates skipped` : ""}`); })}>Import {prev.count}</button>
        </div>) : <p className="text-[13px] text-danger">Couldn&apos;t find date and amount columns. The first row should be a header like “Date, Description, Amount”.</p>)}
    </div>
  );
}
export function Contribute({ id }: { id: number }) {
  const [v, setV] = useState(""), [, start] = useTransition();
  return <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const n = Number(v); if (n) start(async () => { await contributeAction(id, n); setV(""); toast("Saved"); }); }}><input value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" placeholder="Add" aria-label="Contribution" className="field !h-8 !w-20 text-right text-[13px]" /><button className="btn !h-8 text-xs">+</button></form>;
}
export function SubMenu({ id, status, autoLog }: { id: number; status: string; autoLog: boolean }) {
  const [, start] = useTransition();
  const go = (fn: () => Promise<unknown>, msg: string) => start(async () => { await fn(); toast(msg); });
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "active" && !autoLog && <button className="btn !h-7 text-xs" onClick={() => go(() => markPaidAction(id), "Logged and moved to next renewal")}>Mark paid</button>}
      {status === "active" && <button className="btn !h-7 text-xs" onClick={() => go(() => setSubStatusAction(id, "paused"), "Paused")}>Pause</button>}
      {status !== "active" && <button className="btn !h-7 text-xs" onClick={() => go(() => setSubStatusAction(id, "active"), "Reactivated")}>Reactivate</button>}
      {status !== "cancelled" && <button className="btn !h-7 text-xs text-danger" onClick={() => { if (confirm("Mark as cancelled? It stops counting toward your monthly total.")) go(() => setSubStatusAction(id, "cancelled"), "Marked cancelled"); }}>Cancelled it</button>}
      <button className="btn !h-7 text-xs text-mute" onClick={() => { if (confirm("Delete this subscription and its history?")) go(() => deleteSubAction(id), "Deleted"); }}>Delete</button>
    </div>
  );
}
