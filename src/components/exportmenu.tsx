"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/** A small "Export" menu of links. */
export function ExportMenu({ items, label = "Export" }: { items: { label: string; href: string; download?: boolean; newTab?: boolean }[]; label?: string }) {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const d = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }, k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); document.addEventListener("mousedown", d); document.addEventListener("keydown", k); return () => { document.removeEventListener("mousedown", d); document.removeEventListener("keydown", k); }; }, [open]);
  return (
    <div ref={ref} className="relative">
      <button className="btn !px-2.5" aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen((o) => !o)}><Icon name="download" size={15} className="text-mute" /></button>
      {open && <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border bg-panel p-1 shadow-[0_8px_30px_rgb(0_0_0/0.15)]">{items.map((i) => <a key={i.label} role="menuitem" href={i.href} {...(i.download ? { download: true } : {})} {...(i.newTab ? { target: "_blank", rel: "noreferrer" } : {})} onClick={() => setOpen(false)} className="block rounded-md px-2.5 py-1.5 text-[13px] hover:bg-raise">{i.label}</a>)}</div>}
    </div>
  );
}
