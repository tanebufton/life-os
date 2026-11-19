"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { archiveProject } from "@/lib/actions";
import { renameProjectAction } from "@/lib/actions5";
import { Icon } from "./Icon";

/** Edit a project: icon, name, area and colour. Opens as a small panel under the button. Archive lives here too. */
export function ProjectEditor({ id, name, color, icon = "", area = "", areas = [] }: { id: number; name: string; color: string; icon?: string; area?: string; areas?: string[] }) {
  const [open, setOpen] = useState(false), [n, setN] = useState(name), [c, setC] = useState(color), [ic, setIc] = useState(icon), [ar, setAr] = useState(area), [busy, start] = useTransition();
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false), m = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-pedit]")) setOpen(false); }; window.addEventListener("keydown", k); window.addEventListener("mousedown", m); return () => { window.removeEventListener("keydown", k); window.removeEventListener("mousedown", m); }; }, [open]);
  const label = "mb-1 block text-xs font-medium text-mute";
  return (
    <div className="relative" data-pedit>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn"><Icon name="edit" size={14} className="text-mute" />Edit</button>
      {open && (
        <form className="absolute right-0 top-full z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border bg-panel p-4 shadow-[0_8px_30px_rgb(0_0_0/0.15)]"
          onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await renameProjectAction(id, n, c, ic, ar); if (r.ok) { toast("Project updated"); setOpen(false); } else toast(r.error); }); }}>
          <div className="flex gap-2">
            <div><label className={label} htmlFor="pe-icon">Icon</label><input id="pe-icon" value={ic} onChange={(e) => setIc(e.target.value)} placeholder="😀" maxLength={8} className="field !w-14 text-center" /></div>
            <div className="min-w-0 flex-1"><label className={label} htmlFor="pe-name">Name</label><input id="pe-name" value={n} onChange={(e) => setN(e.target.value)} maxLength={60} required className="field" /></div>
          </div>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1"><label className={label} htmlFor="pe-area">Area</label><input id="pe-area" value={ar} onChange={(e) => setAr(e.target.value)} list="areas" placeholder="e.g. Work, Personal" maxLength={40} className="field" /><datalist id="areas">{areas.map((a) => <option key={a} value={a} />)}</datalist></div>
            <div><label className={label} htmlFor="pe-colour">Colour</label><input id="pe-colour" type="color" value={c} onChange={(e) => setC(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-0.5" /></div>
          </div>
          <div className="flex items-center gap-2 border-t pt-3">
            <button className="btn-primary" disabled={busy}>Save</button><button type="button" className="btn" onClick={() => { setOpen(false); setN(name); setC(color); setIc(icon); setAr(area); }}>Cancel</button>
            <button type="button" formNoValidate className="ml-auto text-[13px] text-mute hover:text-danger" onClick={() => { if (confirm("Archive this project? Its tasks stay; you can restore it from Settings.")) void archiveProject(id); }}>Archive</button>
          </div>
        </form>
      )}
    </div>
  );
}
