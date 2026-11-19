"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moveNoteAction, setNoteIconAction } from "@/lib/actions5";
import { Icon } from "./Icon";

/** The page icon, sitting to the left of the title. Click to set or change it. */
export function NoteIcon({ id, icon }: { id: number; icon: string }) {
  const router = useRouter(), [ic, setIc] = useState(icon), [edit, setEdit] = useState(false), [, go] = useTransition();
  const save = () => { setEdit(false); if (ic !== icon) go(async () => { const r = await setNoteIconAction(id, ic); if (!r.ok) toast(r.error); router.refresh(); }); };
  if (edit) return <input autoFocus value={ic} onChange={(e) => setIc(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setIc(icon); setEdit(false); } }} maxLength={8} placeholder="😀" aria-label="Page icon" className="field !h-11 !w-14 shrink-0 text-center text-2xl" />;
  return <button type="button" onClick={() => setEdit(true)} aria-label={icon ? "Change page icon" : "Add a page icon"} title={icon ? "Change icon" : "Add an icon"} className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[28px] leading-none hover:bg-raise ${icon ? "" : "border border-dashed text-base text-dim"}`}>{icon || <Icon name="plus" size={16} />}</button>;
}

/** Which page this note sits under. */
export function NoteInside({ id, parentId, options }: { id: number; parentId: number | null; options: { id: number; title: string; depth: number }[] }) {
  const router = useRouter(), [, go] = useTransition();
  return (
    <label className="inline-flex items-center gap-1.5 text-[13px] text-mute"><Icon name="tree" size={14} />
      <select value={parentId ?? ""} aria-label="Parent page" className="ghost !w-auto !py-0.5" onChange={(e) => go(async () => { const r = await moveNoteAction(id, e.target.value ? Number(e.target.value) : null); if (!r.ok) toast(r.error); else router.refresh(); })}>
        <option value="">Top level</option>{options.map((o) => <option key={o.id} value={o.id}>{"\u00A0\u00A0".repeat(o.depth)}{o.title || "Untitled"}</option>)}</select></label>
  );
}
