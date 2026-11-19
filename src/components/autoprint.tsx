"use client";
import { useEffect } from "react";

/** Opens the print dialog once the page has rendered, and wires the Print button. */
export function AutoPrint() {
  useEffect(() => { const b = document.getElementById("print-btn"); const f = () => window.print(); b?.addEventListener("click", f); const t = setTimeout(f, 500); return () => { clearTimeout(t); b?.removeEventListener("click", f); }; }, []);
  return null;
}
