"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renameProjectAction } from "@/lib/actions5";
import { Icon } from "./Icon";

/** Rename a project and change its colour. */
export function ProjectEditor({ id, name, color }: { id: number; name: string; color: string }) {
  const [open, setOpen] = useState(false), [n, setN] = useState(name), [c, setC] = useState(color), [busy, start] = useTransition();
  if (!open) return <button onClick={() => setOpen(true)} className="-mt-3 mb-4 inline-flex items-center gap-1.5 text-xs text-mute hover:text-fg"><Icon name="edit" size={13} />Rename or recolour</button>;
  return (
    <form className="-mt-2 mb-5 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await renameProjectAction(id, n, c); if (r.ok) { toast("Project updated"); setOpen(false); } else toast(r.error); }); }}>
      <input value={n} onChange={(e) => setN(e.target.value)} aria-label="Project name" maxLength={60} className="field !w-auto min-w-56" /><input type="color" value={c} onChange={(e) => setC(e.target.value)} aria-label="Colour" className="h-9 w-10 cursor-pointer rounded-md border bg-transparent p-0.5" />
      <button className="btn-primary" disabled={busy}>Save</button><button type="button" className="text-xs text-mute hover:text-fg" onClick={() => { setOpen(false); setN(name); setC(color); }}>Cancel</button>
    </form>
  );
}
