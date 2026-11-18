"use client";
import { useState, useTransition } from "react";
import { setFeatureAction } from "@/lib/actions";

export function FeatureSwitch({ k, on, label }: { k: string; on: boolean; label: string }) {
  const [v, setV] = useState(on);
  const [, start] = useTransition();
  return (
    <button role="switch" aria-checked={v} aria-label={label} onClick={() => { const n = !v; setV(n); start(async () => { await setFeatureAction(k, n); }); }}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${v ? "bg-accent" : "bg-fg/20"}`}>
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${v ? "translate-x-4" : ""}`} />
    </button>
  );
}
