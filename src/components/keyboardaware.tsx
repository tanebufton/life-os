"use client";
import { useEffect } from "react";

const typing = (el: Element | null) => !!el && ((el instanceof HTMLInputElement && !/^(checkbox|radio|button|submit|range|color|file|date|time)$/.test(el.type)) || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable);
/**
 * Phones: when the on-screen keyboard is up, hide the bottom bar and the new-task button (they'd sit in the little space left),
 * and scroll the field you tapped into view once the keyboard has finished sliding up.
 */
export function KeyboardAware() {
  useEffect(() => {
    if (!matchMedia("(pointer: coarse)").matches) return;
    const root = document.documentElement; let off: ReturnType<typeof setTimeout> | undefined;
    const inn = (e: FocusEvent) => {
      if (!typing(e.target as Element)) return; clearTimeout(off); root.dataset.kb = "1";
      const el = e.target as HTMLElement; if (el.closest("[role=dialog]")) return; // overlays position themselves
      setTimeout(() => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ } }, 320);
    };
    const out = () => { off = setTimeout(() => { if (!typing(document.activeElement)) delete root.dataset.kb; }, 150); }; // moving between fields shouldn't flicker the bar back
    document.addEventListener("focusin", inn); document.addEventListener("focusout", out);
    return () => { document.removeEventListener("focusin", inn); document.removeEventListener("focusout", out); delete root.dataset.kb; };
  }, []);
  return null;
}
