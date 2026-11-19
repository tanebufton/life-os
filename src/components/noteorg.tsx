"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moveNoteAction, setNoteIconAction } from "@/lib/actions5";

/** Where a note lives (under which page) and its emoji. */
export function NoteOrganise({ id, parentId, icon, options }: { id: number; parentId: number | null; icon: string; options: { id: number; title: string; depth: number }[] }) {
  const router = useRouter(), [ic, setIc] = useState(icon), [, go] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
      <label className="flex items-center gap-2 text-mute">Icon
        <input value={ic} onChange={(e) => setIc(e.target.value)} onBlur={() => { if (ic !== icon) go(async () => { const r = await setNoteIconAction(id, ic); if (!r.ok) toast(r.error); router.refresh(); }); }} maxLength={8} placeholder="😀" aria-label="Page icon" className="field !w-14 !py-0.5 text-center" /></label>
      <label className="flex items-center gap-2 text-mute">Inside
        <select value={parentId ?? ""} aria-label="Parent page" className="field !w-auto !py-0.5 text-[13px]" onChange={(e) => go(async () => { const r = await moveNoteAction(id, e.target.value ? Number(e.target.value) : null); if (!r.ok) toast(r.error); else router.refresh(); })}>
          <option value="">Top level</option>{options.map((o) => <option key={o.id} value={o.id}>{"  ".repeat(o.depth)}{o.title || "Untitled"}</option>)}</select></label>
    </div>
  );
}
