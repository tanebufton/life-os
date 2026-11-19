"use client";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { markRangePaidAction, setChargeAction, setSetAsideAction } from "@/lib/actions5";
import { Icon } from "./Icon";

/** One charge with a tick: "I've paid this one". */
export function PayTick({ subId, due, paid, label }: { subId: number; due: string; paid: boolean; label: string }) {
  const router = useRouter(), [on, set] = useOptimistic(paid, (_s, v: boolean) => v), [, go] = useTransition();
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={`${on ? "Mark unpaid" : "Mark paid"}: ${label}`} onClick={() => go(async () => { set(!on); const r = await setChargeAction(subId, due, !on); if (!r.ok) toast(r.error); router.refresh(); })}
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${on ? "border-ok bg-ok text-white" : "border-line/40 hover:border-ok hover:bg-ok/10"}`}>{on && <Icon name="check" size={13} />}</button>
  );
}

export function MarkAllPaid({ from, to, left }: { from: string; to: string; left: number }) {
  const router = useRouter(), [busy, go] = useTransition();
  return <button type="button" disabled={busy || !left} className="btn" onClick={() => go(async () => { const r = await markRangePaidAction(from, to); toast(r.ok ? (r.message ?? "Done") : r.error); router.refresh(); })}><Icon name="check" size={14} className="text-ok" />{left ? `Mark all paid (${left})` : "All paid"}</button>;
}

/** "I've moved this pay's share into my bills account." */
export function SetAsideTick({ from, done }: { from: string; done: boolean }) {
  const router = useRouter(), [on, set] = useOptimistic(done, (_s, v: boolean) => v), [, go] = useTransition();
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={() => go(async () => { set(!on); const r = await setSetAsideAction(from, !on); if (!r.ok) toast(r.error); router.refresh(); })}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${on ? "border-ok/40 bg-ok/10 text-ok" : "hover:bg-raise"}`}>
      <span className={`grid h-4 w-4 place-items-center rounded-full border ${on ? "border-ok bg-ok text-white" : "border-line/40"}`}>{on && <Icon name="check" size={11} />}</span>{on ? "Set aside for this pay" : "Mark as set aside"}
    </button>
  );
}
