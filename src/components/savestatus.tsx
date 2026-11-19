"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export type SaveState = "idle" | "saving" | "saved" | "kept" | "error";
const pill = "save-pop inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium";

/**
 * The little "Saved" indicator. A spinner while saving, a green tick the moment it lands (which then settles into a quiet "All changes saved"),
 * amber when the text is only safe in this browser, red when it failed. The slot keeps its height so nothing jumps.
 */
export function SaveStatus({ state, error, className = "" }: { state: SaveState; error?: string; className?: string }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => { setSettled(false); if (state !== "saved") return; const t = setTimeout(() => setSettled(true), 2200); return () => clearTimeout(t); }, [state]);
  let body: React.ReactNode = null;
  if (state === "saving") body = <span key="s" className={`${pill} bg-raise text-mute`}><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />Saving…</span>;
  else if (state === "saved") body = settled
    ? <span key="q" className="inline-flex h-6 items-center gap-1.5 px-1 text-xs text-dim"><Icon name="check" size={12} />All changes saved</span>
    : <span key="o" className={`${pill} bg-ok/10 text-ok`}><Icon name="check" size={13} />Saved</span>;
  else if (state === "kept") body = <span key="k" className={`${pill} bg-warn/10 text-warn`}><Icon name="alert" size={13} />Not saved yet · kept safely in this browser</span>;
  else if (state === "error") body = <span key="e" className={`${pill} bg-danger/10 text-danger`}><Icon name="alert" size={13} />{error || "Couldn't save"}</span>;
  return <div className={`flex h-6 items-center ${className}`} aria-live="polite">{body}</div>;
}
