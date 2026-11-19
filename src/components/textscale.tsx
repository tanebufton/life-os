"use client";
import { useEffect, useState } from "react";

const SIZES: [number, string][] = [[85, "Smaller"], [92, "Small"], [100, "Default"], [110, "Large"]];
export const applyScale = (n: number) => { const el = document.documentElement; if (n === 100) { el.style.removeProperty("zoom"); el.style.removeProperty("--z"); } else { el.style.zoom = String(n / 100); el.style.setProperty("--z", String(n / 100)); } };
/** Text and layout size for this device (remembered on this device only, so a phone and a desktop can differ). */
export function TextScale() {
  const [v, setV] = useState(100);
  useEffect(() => { try { const s = Number(localStorage.getItem("lifeos.scale")); if (s) setV(s); } catch { /* default */ } }, []);
  const pick = (n: number) => { setV(n); applyScale(n); try { if (n === 100) localStorage.removeItem("lifeos.scale"); else localStorage.setItem("lifeos.scale", String(n)); } catch { /* ignore */ } };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-sm">Text size</div><div className="text-xs text-mute">Applies to this device only.</div></div>
      <div role="radiogroup" aria-label="Text size" className="inline-flex rounded-lg bg-raise p-0.5">{SIZES.map(([n, l]) => <button key={n} role="radio" aria-checked={v === n} onClick={() => pick(n)} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${v === n ? "bg-panel shadow-sm" : "text-mute hover:text-fg"}`}>{l}</button>)}</div>
    </div>
  );
}
