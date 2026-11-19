"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { ProjectAvatar } from "./Pill";
import { SETTINGS_PAGE, visiblePages, type Features } from "@/lib/nav";
import { focusCapture, type NavProject } from "./shell";

type Item = { label: string; group: string; hint?: string; icon?: string; project?: NavProject; run: () => void };

type FoundHit = { kind: string; id: number; title: string; href: string; meta?: string; snippet?: string };
type FoundGroup = { kind: string; label: string; items: FoundHit[] };
const KIND_ICON: Record<string, string> = { task: "circleCheck", note: "notes", goal: "goals", person: "people", memo: "mic", project: "list" };
export function Palette({ projects, features }: { projects: NavProject[]; features: Features }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const [found, setFound] = useState<FoundGroup[]>([]);
  useEffect(() => { if (!open || q.trim().length < 2) { setFound([]); return; } const c = new AbortController(); const t = setTimeout(() => fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: c.signal }).then((r) => r.json()).then((j) => setFound(j.groups ?? [])).catch(() => {}), 150); return () => { clearTimeout(t); c.abort(); }; }, [q, open]);

  useEffect(() => {
    const toggle = () => { setOpen((o) => !o); setQ(""); setSel(0); };
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); toggle(); } if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k); window.addEventListener("lifeos:palette", toggle);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("lifeos:palette", toggle); };
  }, []);

  const go = (href: string) => () => { setOpen(false); router.push(href); };
  const items = useMemo<Item[]>(() => [
    { label: "New task", group: "Actions", icon: "plus", hint: "C", run: () => { setOpen(false); setTimeout(focusCapture, 30); } },
    ...[...visiblePages(features), SETTINGS_PAGE].map((p) => ({ label: p.label, group: "Go to", icon: p.icon, hint: `G ${p.key.toUpperCase()}`, run: go(p.href) })),
    ...(features.board ? [] : []),
    ...projects.flatMap((p) => [
      { label: p.name, group: "Projects", project: p, run: go(`/projects/${p.id}`) },
      ...(features.board ? [{ label: `${p.name} board`, group: "Projects", project: p, run: go(`/board?project=${p.id}`) }] : []),
    ]),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [projects, features]);
  const taskItems: Item[] = found.flatMap((g) => g.items.map((h) => ({ label: h.title, group: g.label, icon: KIND_ICON[h.kind] ?? "search", hint: h.meta ?? undefined, run: go(h.href) })));
  const shown = [...taskItems, ...items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()))].concat(q.trim().length >= 2 ? [{ label: `Search everything for “${q.trim()}”`, group: "Search", icon: "search", run: go(`/search?q=${encodeURIComponent(q.trim())}`) }] : []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-items-center bg-black/35 px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-panel shadow-[0_20px_60px_rgb(0_0_0/0.25)]">
        <div className="flex items-center gap-3 border-b px-4"><Icon name="search" className="text-mute" size={18} />
          <input ref={ref} autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder="Search or jump to…"
            onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, shown.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); } else if (e.key === "Enter") shown[sel]?.run(); }}
            className="flex-1 bg-transparent py-3.5 text-[15px] outline-none placeholder:text-dim" /></div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {shown.map((it, i) => (
            <li key={it.group + it.label}>
              {(i === 0 || shown[i - 1].group !== it.group) && <div className="px-2.5 pb-1 pt-2 text-xs font-semibold text-dim">{it.group}</div>}
              <button onMouseEnter={() => setSel(i)} onClick={it.run} className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm ${i === sel ? "bg-raise" : ""}`}>
                {it.project ? <ProjectAvatar name={it.project.name} color={it.project.color} /> : <Icon name={it.icon ?? "arrow"} size={17} className="text-mute" />}
                <span className="flex-1">{it.label}</span>{it.hint && <span className="text-xs text-dim">{it.hint}</span>}</button></li>
          ))}
          {!shown.length && <li className="px-3 py-8 text-center text-sm text-dim">No results</li>}
        </ul>
      </div>
    </div>
  );
}
