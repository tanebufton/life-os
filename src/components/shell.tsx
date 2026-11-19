"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { addProject } from "@/lib/actions";
import { moveProjectToAreaAction, moveTaskToProjectAction, reorderProjectsAction, resetSidebarAction, saveSidebarAction } from "@/lib/actions5";
import type { Fav } from "@/lib/favourites";
import { arrange, withVisibility, EMPTY_PREFS, type SidebarPrefs } from "@/lib/sidebar";
import { toast } from "sonner";
import { NAV, SETTINGS_PAGE, visiblePages, type Features, type NavPage } from "@/lib/nav";
import { CaptureForm } from "./capture";
import { Icon } from "./Icon";
import { ProjectAvatar } from "./Pill";
import { ThemeToggle } from "./theme";

export type NavProject = { id: number; name: string; color: string; open: number; icon?: string; area?: string };
export type Counts = { due: number; open: number; doing: number; inbox: number };

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
export const openPalette = () => window.dispatchEvent(new Event("lifeos:palette"));
export const openHelp = () => window.dispatchEvent(new Event("lifeos:help"));
export function toggleSidebar() {
  const h = document.documentElement, on = h.dataset.sidebar !== "collapsed";
  if (on) h.dataset.sidebar = "collapsed"; else delete h.dataset.sidebar;
  try { localStorage.setItem("lifeos.sidebar", on ? "collapsed" : "open"); } catch {}
}
export const focusCapture = () => (document.getElementById("capture") as HTMLInputElement | null)?.focus() ?? window.dispatchEvent(new Event("lifeos:capture"));

export function Hotkeys({ features }: { features: Features }) {
  const router = useRouter();
  useEffect(() => {
    let g = 0;
    const pages = [...visiblePages(features), SETTINGS_PAGE];
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return;
      if ((e.key === "c" || e.key === "/") && !g) { e.preventDefault(); focusCapture(); return; }
      if (e.key === "[") { e.preventDefault(); toggleSidebar(); return; }
      if (e.key === "?") { e.preventDefault(); openHelp(); return; }
      if (g && Date.now() - g < 1200) { const p = pages.find((x) => x.key === e.key.toLowerCase()); g = 0; if (p) { e.preventDefault(); router.push(p.href); } return; }
      g = e.key === "g" ? Date.now() : 0;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, features]);
  return null;
}

const row = "flex min-h-[30px] items-center gap-2.5 rounded-md px-2 text-[14px] transition-colors";
export function Sidebar({ counts, projects, features, filters = [], favourites = [], prefs: savedPrefs = EMPTY_PREFS }: { counts: Counts; projects: NavProject[]; features: Features; filters?: { id: number; name: string; query: string }[]; favourites?: Fav[]; prefs?: SidebarPrefs }) {
  const path = usePathname(), sp = useSearchParams();
  const router = useRouter(), [dropOn, setDropOn] = useState<number | null>(null);
  const isTaskDrag = (e: React.DragEvent) => e.dataTransfer.types.includes("application/x-lifeos-task");
  const isProjDrag = (e: React.DragEvent) => e.dataTransfer.types.includes("application/x-lifeos-project");
  const [dragProj, setDragProj] = useState<number | null>(null), [before, setBefore] = useState<number | null>(null);
  /** Drop a project onto another in the same area: it takes that spot and the rest shuffle down. */
  const dropProject = (target: NavProject) => {
    const from = projects.find((x) => x.id === dragProj); setBefore(null); setDragProj(null);
    if (!from || from.id === target.id) return;
    if ((from.area ?? "") !== (target.area ?? "")) { void moveProjectToAreaAction(from.id, target.area ?? "", target.id).then((r) => { toast(r.ok ? `Moved to ${target.area || "Other"}` : r.error); router.refresh(); }); return; } // dropped on a project in another area: join that area, just above it
    const ids = projects.filter((x) => (x.area ?? "") === (from.area ?? "")).map((x) => x.id).filter((i) => i !== from.id); ids.splice(ids.indexOf(target.id), 0, from.id);
    void reorderProjectsAction(ids).then((r) => { if (!r.ok) toast(r.error); router.refresh(); });
  };
  const [collapsed, setCollapsed] = useState<string[]>(["life", "explore", "filters"]);
  useEffect(() => { try { const v = localStorage.getItem("lifeos.sb.collapsed"); if (v) setCollapsed(JSON.parse(v)); } catch { /* keep defaults */ } }, []);
  const toggle = (k: string) => setCollapsed((c) => { const n = c.includes(k) ? c.filter((x) => x !== k) : [...c, k]; try { localStorage.setItem("lifeos.sb.collapsed", JSON.stringify(n)); } catch { /* ignore */ } return n; });
  const [adding, setAdding] = useState(false), [editing, setEditing] = useState(false), [prefs, setPrefs] = useState<SidebarPrefs>(savedPrefs), [drag, setDrag] = useState<string | null>(null);
  useEffect(() => setPrefs(savedPrefs), [savedPrefs]);
  const persist = (next: SidebarPrefs) => { setPrefs(next); void saveSidebarAction(next).then((r) => { if (!r.ok) toast(r.error); }); };
  const badge: Record<string, number | undefined> = { "/": counts.due, "/inbox": counts.inbox, "/board": counts.doing };
  const pages = visiblePages(features);
  const link = (p: NavPage) => {
    const on = isActive(path, p.href), n = badge[p.href];
    return (
      <Link key={p.href} href={p.href} className={`${row} ${on ? "bg-raise font-medium" : "text-fg/80 hover:bg-raise/70"}`}>
        <Icon name={p.icon} size={17} className={on ? "text-accent" : "text-mute"} /><span className="flex-1">{p.label}</span>
        {n ? <span className={`text-xs ${p.href === "/" && counts.due ? "font-medium text-warn" : p.href === "/inbox" ? "font-medium text-accent" : "text-dim"}`}>{n}</span> : null}
      </Link>
    );
  };
  const arranged = arrange(pages, prefs);
  const flat = (key: string) => arranged.find((g) => g.key === key)!.items.map((i) => i.page.href);
  /** Put `href` where `before` is (or at the end of the group). Works on the flat saved order, so other groups keep their place. */
  const place = (href: string, before: string | null, groupKey: string) => {
    const g = flat(groupKey).filter((h) => h !== href); const at = before ? g.indexOf(before) : g.length; g.splice(at < 0 ? g.length : at, 0, href);
    const others = prefs.order.filter((h) => !g.includes(h) && !flat(groupKey).includes(h)); persist({ ...prefs, order: [...others, ...g] });
  };
  const bump = (groupKey: string, href: string, dir: -1 | 1) => { const g = flat(groupKey), i = g.indexOf(href), j = i + dir; if (j < 0 || j >= g.length) return; place(href, dir < 0 ? g[j] : g[j + 1] ?? null, groupKey); };
  const bumpGroup = (key: string, dir: -1 | 1) => { const g = arranged.map((x) => x.key as string), i = g.indexOf(key), j = i + dir; if (j < 0 || j >= g.length) return; [g[i], g[j]] = [g[j], g[i]]; persist({ ...prefs, groups: g }); };
  const editRow = (p: NavPage, hidden: boolean, gk: string) => (
    <div key={p.href} draggable onDragStart={() => setDrag(p.href)} onDragEnd={() => setDrag(null)} onDragOver={(e) => { if (drag) e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); if (drag && drag !== p.href && pages.find((x) => x.href === drag)?.group === gk) place(drag, p.href, gk); setDrag(null); }}
      className={`${row} cursor-grab gap-1.5 ${hidden ? "opacity-50" : ""} ${drag === p.href ? "bg-accent/10" : "hover:bg-raise/70"}`}>
      <Icon name="grip" size={14} className="text-dim" /><Icon name={p.icon} size={16} className="text-mute" /><span className="flex-1 truncate">{p.label}</span>
      <button aria-label={`Move ${p.label} up`} onClick={() => bump(gk, p.href, -1)} className="rounded p-0.5 text-dim hover:bg-raise hover:text-fg"><Icon name="chevDown" size={13} className="rotate-180" /></button>
      <button aria-label={`Move ${p.label} down`} onClick={() => bump(gk, p.href, 1)} className="rounded p-0.5 text-dim hover:bg-raise hover:text-fg"><Icon name="chevDown" size={13} /></button>
      <button aria-label={hidden ? `Show ${p.label}` : `Hide ${p.label}`} aria-pressed={!hidden} disabled={p.href === "/"} onClick={() => persist(withVisibility(prefs, p, !hidden))} className="rounded p-0.5 text-mute hover:bg-raise hover:text-fg disabled:invisible"><Icon name={hidden ? "eyeoff" : "eye"} size={14} /></button>
    </div>
  );
  const chev = (open: boolean) => <Icon name="chevDown" size={12} className={`text-dim transition ${open ? "" : "-rotate-90"}`} />;
  const projectNav = (pid: number) => {
    const tab = path === `/projects/${pid}` ? (sp.get("tab") ?? "overview") : "";
    const items = [["overview", "Overview", "today", true], ["list", "List", "list", true], ["board", "Board", "board", features.board], ["table", "Table", "grid", true], ["notes", "Notes", "notes", features.notes], ["memos", "Voice memos", "mic", features.voice], ["goals", "Goals", "goals", features.goals]] as const;
    return <div className="mb-1 ml-[15px] space-y-px border-l pl-2">{items.filter((i) => i[3]).map(([k, label, icon]) => <Link key={k} href={`/projects/${pid}?tab=${k}`} className={`${row} !min-h-[27px] text-[13px] ${tab === k || (k === "list" && tab === "tasks") ? "bg-raise font-medium" : "text-fg/75 hover:bg-raise/70"}`}><Icon name={icon} size={15} className={tab === k ? "text-accent" : "text-mute"} />{label}</Link>)}</div>;
  };
  const favSection = favourites.length > 0 ? (
    <div key="favs" className="mt-3">
      <div className="px-4 pb-1 text-xs font-semibold text-mute">Favourites</div>
      <div className="space-y-px px-2">{favourites.map((f) => { const on = path === f.href; return (
        <Link key={`${f.kind}${f.id}`} href={f.href} className={`${row} ${on ? "bg-raise font-medium" : "text-fg/80 hover:bg-raise/70"}`}>
          {f.kind === "project" ? <ProjectAvatar name={f.title} color={f.color ?? "#6366f1"} icon={f.icon} /> : f.icon ? <span className="grid h-[17px] w-[17px] place-items-center text-[14px] leading-none" aria-hidden>{f.icon}</span> : <Icon name={f.kind === "note" ? "notes" : "list"} size={17} className="text-mute" />}
          <span className="flex-1 truncate">{f.title}</span></Link>); })}</div>
    </div>
  ) : null;
  const projectsSection = (
    <div key="projects" className="mt-4">
      <div className="group flex items-center justify-between px-4 pb-1"><span className="text-xs font-semibold text-mute">Projects</span>
        <button onClick={() => setAdding((a) => !a)} aria-label="New project" className="rounded p-0.5 text-mute opacity-0 transition hover:bg-raise hover:text-fg group-hover:opacity-100 focus:opacity-100"><Icon name={adding ? "x" : "plus"} size={14} /></button></div>
      <div className="space-y-px px-2">
        {adding && (
          <form action={async (fd) => { await addProject(fd); setAdding(false); }} className="mb-1 flex gap-1.5 px-1">
            <input name="name" required autoFocus placeholder="Project name" className="field !py-1" />
            <input type="color" name="color" defaultValue="#1877f2" aria-label="Colour" className="h-8 w-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5" />
          </form>
        )}
        {projects.map((p, i) => {
          const here = path === `/projects/${p.id}`, showArea = projects.some((x) => x.area) && (i === 0 || projects[i - 1].area !== p.area);
          return (
            <div key={p.id}>
              {showArea && <div onDragOver={(e) => { if (isProjDrag(e)) { e.preventDefault(); setBefore(p.id); } }} onDragLeave={() => setBefore((d) => (d === p.id ? null : d))} onDrop={(e) => { if (isProjDrag(e)) { e.preventDefault(); dropProject(p); } }}
                className={`rounded px-2 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-dim ${dragProj !== null && before === p.id ? "text-accent" : ""}`}>{p.area || "Other"}</div>}
              <Link href={`/projects/${p.id}`} draggable onDragStart={(e) => { e.dataTransfer.setData("application/x-lifeos-project", String(p.id)); e.dataTransfer.effectAllowed = "move"; setDragProj(p.id); }} onDragEnd={() => { setDragProj(null); setBefore(null); }}
                onDragOver={(e) => { if (isTaskDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropOn(p.id); } else if (isProjDrag(e) && dragProj !== null && dragProj !== p.id) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setBefore(p.id); } }} onDragLeave={() => { setDropOn((d) => (d === p.id ? null : d)); setBefore((d) => (d === p.id ? null : d)); }}
                onDrop={(e) => { if (isProjDrag(e)) { e.preventDefault(); dropProject(p); return; } if (!isTaskDrag(e)) return; e.preventDefault(); setDropOn(null); const id = Number(e.dataTransfer.getData("application/x-lifeos-task")); void moveTaskToProjectAction(id, p.id).then((r) => { toast(r.ok ? (r.message ?? "Moved") : r.error); router.refresh(); }); }}
                className={`${row} ${before === p.id ? "shadow-[0_-2px_0_0_rgb(var(--accent))]" : ""} ${dragProj === p.id ? "opacity-40" : ""} ${dropOn === p.id ? "bg-accent/15 ring-2 ring-accent" : here && !sp.get("tab") ? "bg-raise font-medium" : here ? "font-medium" : "text-fg/80 hover:bg-raise/70"}`}>
                <ProjectAvatar name={p.name} color={p.color} icon={p.icon} /><span className="flex-1 truncate">{p.name}</span>{p.open > 0 && <span className="text-xs text-dim">{p.open}</span>}
              </Link>
              {here && projectNav(p.id)}
            </div>
          );
        })}
        {!projects.length && !adding && <p className="px-2 py-1 text-xs text-dim">No projects yet.</p>}
      </div>
    </div>
  );
  const sections = arranged.flatMap((g, gi) => {
    const visible = g.items.filter((i) => !i.hidden);
    if (g.key === "projects") return editing
      ? [<div key="projects-edit" className="mt-3"><div className="flex items-center px-4 pb-1 text-xs font-semibold text-mute"><span className="flex-1">Projects &amp; favourites</span>
          <button aria-label="Move projects up" onClick={() => bumpGroup(g.key, -1)} className="rounded p-0.5 hover:bg-raise"><Icon name="chevDown" size={13} className="rotate-180" /></button><button aria-label="Move projects down" onClick={() => bumpGroup(g.key, 1)} className="rounded p-0.5 hover:bg-raise"><Icon name="chevDown" size={13} /></button></div></div>, favSection, projectsSection]
      : [favSection, projectsSection];
    if (!editing && !visible.length) return [];
    const open = editing || !g.title || !collapsed.includes(g.key) || visible.some((i) => isActive(path, i.page.href));
    const out = (
      <div key={g.key} className={gi === 0 && !g.title ? "" : "mt-3"}>
        {(g.title || editing) && <div className="flex items-center px-4 pb-1 text-xs font-semibold text-mute">
          {editing || !g.title ? <span className="flex-1">{g.title || "Top"}</span> : <button onClick={() => toggle(g.key)} aria-expanded={open} className="-ml-1 flex flex-1 items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-raise hover:text-fg">{chev(open)}{g.title}</button>}
          {editing && <><button aria-label={`Move ${g.title || "top"} group up`} onClick={() => bumpGroup(g.key, -1)} className="rounded p-0.5 hover:bg-raise"><Icon name="chevDown" size={13} className="rotate-180" /></button><button aria-label={`Move ${g.title || "top"} group down`} onClick={() => bumpGroup(g.key, 1)} className="rounded p-0.5 hover:bg-raise"><Icon name="chevDown" size={13} /></button></>}</div>}
        {open && <div className="space-y-px px-2">{(editing ? g.items : visible).map((i) => (editing ? editRow(i.page, i.hidden, g.key) : link(i.page)))}</div>}
      </div>
    );
    return [out];
  });
  return (
    <aside className="side hidden w-[260px] shrink-0 flex-col border-r bg-side md:flex">
      <div className="px-2 pb-1 pt-2.5">
        <WorkspaceMenu editing={editing} onEdit={() => setEditing((e) => !e)} onReset={() => void resetSidebarAction().then((r) => toast(r.ok ? (r.message ?? "Done") : r.error))} hiddenPages={arranged.flatMap((g) => g.items).filter((i) => i.hidden).map((i) => i.page)} />
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto pb-6 [mask-image:linear-gradient(to_bottom,#000_calc(100%-24px),transparent)]">
        {sections}
        {editing && <div className="mx-3 mt-3 rounded-lg border border-dashed p-2.5 text-xs text-mute">Drag pages (or use the arrows) to reorder them. The eye hides a page from this list; it stays reachable from search (⌘K) and the LifeOS menu. <button className="mt-1.5 block font-medium text-accent hover:underline" onClick={() => setEditing(false)}>Done</button></div>}
        {filters.length > 0 && <div className="mt-3"><button onClick={() => toggle("filters")} aria-expanded={!collapsed.includes("filters")} className="mx-3 flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold text-mute hover:bg-raise hover:text-fg">{chev(!collapsed.includes("filters"))}Saved filters</button>{!collapsed.includes("filters") && <div className="mt-1 space-y-px px-2">{filters.map((f) => <Link key={f.id} href={`/search?q=${encodeURIComponent(f.query)}`} className={`${row} text-fg/80 hover:bg-raise/70`}><Icon name="search" size={16} className="text-mute" /><span className="truncate">{f.name}</span></Link>)}</div>}</div>}
      </div>
      <div className="space-y-px border-t px-2 py-2">
        <Link href="/settings" className={`${row} ${path === "/settings" ? "bg-raise font-medium" : "text-fg/80 hover:bg-raise/70"}`}><Icon name="settings" size={17} className="text-mute" />Settings</Link>
        <div className="flex items-center"><ThemeToggle label className={`${row} !w-full !p-0 !px-2 !text-fg/80`} /><button onClick={openHelp} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" className="mr-1 rounded-md p-1.5 text-mute hover:bg-raise hover:text-fg"><Icon name="keyboard" size={16} /></button></div>
      </div>
    </aside>
  );
}

function crumbs(path: string, projects: NavProject[]): string[] {
  if (path === "/") return ["Today"];
  if (path.startsWith("/projects/")) return ["Projects", projects.find((p) => `/projects/${p.id}` === path)?.name ?? "Project"];
  if (path.startsWith("/tasks/")) return ["My tasks", "Task"];
  if (path === "/more") return ["More"];
  if (path === "/search") return ["Search"];
  if (path.startsWith("/notes/")) return ["Notes", "Page"];
  return [[...NAV, SETTINGS_PAGE].find((p) => isActive(path, p.href))?.label ?? "LifeOS"];
}
export function Topbar({ today, projects }: { today: string; projects: NavProject[] }) {
  const path = usePathname();
  const c = crumbs(path, projects);
  return (
    <header className="topbar sticky top-0 z-20 shrink-0 border-b bg-bg/85 backdrop-blur"><div className="flex h-12 items-center gap-4 px-4 md:px-8">
      <button onClick={toggleSidebar} aria-label="Show or hide the sidebar" title="Show or hide the sidebar ([)" className="-ml-1 hidden rounded-md p-1.5 text-mute hover:bg-raise hover:text-fg md:block"><Icon name="sidebar" size={17} /></button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[14px] md:w-40">
        {c.map((x, i) => (<span key={i} className="flex min-w-0 items-center gap-1.5">{i > 0 && <span className="text-dim">/</span>}<span className={`truncate ${i === c.length - 1 ? "font-semibold" : "text-mute"}`}>{x}</span></span>))}
      </nav>
      <div className="mx-auto hidden w-full max-w-xl md:block"><CaptureForm today={today} variant="pill" /></div>
      <div className="ml-auto flex items-center gap-1.5 md:justify-end"><button onClick={openPalette} aria-label="Search" title="Search (⌘K)" className="rounded-md p-1.5 text-mute hover:bg-raise hover:text-fg"><Icon name="search" size={18} /></button><button onClick={focusCapture} className="btn-primary hidden !h-8 md:inline-flex"><Icon name="plus" size={14} />New task</button></div>
    </div></header>
  );
}

export function MobileNav({ counts, tabs }: { counts: Counts; tabs: NavPage[] }) {
  const path = usePathname();
  const badge: Record<string, number> = { "/": counts.due, "/inbox": counts.inbox };
  const items = [...tabs, { href: "/more", label: "More", icon: "more", key: "", group: "main" } as NavPage];
  return (
    <nav className="mobilenav fixed inset-x-0 bottom-0 z-40 flex border-t bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
      {items.map((p) => {
        const on = isActive(path, p.href) || (p.href === "/more" && !tabs.some((t) => isActive(path, t.href)));
        return (
          <Link key={p.href} href={p.href} className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium ${on ? "text-accent" : "text-mute"}`}>
            <span className="relative"><Icon name={p.icon} size={22} />{badge[p.href] ? <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">{badge[p.href]}</span> : null}</span>
            <span className="max-w-full truncate px-0.5">{p.label === "My tasks" ? "Tasks" : p.label === "Plan & review" ? "Review" : p.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** The LifeOS header menu: edit the sidebar, reach pages you've hidden, settings, shortcuts. */
function WorkspaceMenu({ editing, onEdit, onReset, hiddenPages }: { editing: boolean; onEdit: () => void; onReset: () => void; hiddenPages: NavPage[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false), c = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-wsmenu]")) setOpen(false); }; window.addEventListener("keydown", k); window.addEventListener("mousedown", c); return () => { window.removeEventListener("keydown", k); window.removeEventListener("mousedown", c); }; }, [open]);
  const item = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-raise";
  return (
    <div className="relative" data-wsmenu>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="LifeOS menu" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-raise">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-[5px] bg-accent text-[12px] font-bold text-ink">L</span>
        <span className="text-[14px] font-semibold">LifeOS</span><Icon name="chevDown" size={14} className={`text-dim transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border bg-panel p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.15)]">
          <Link role="menuitem" href="/" onClick={() => setOpen(false)} className={item}><Icon name="today" size={15} className="text-mute" />Home</Link>
          <button role="menuitem" className={item} onClick={() => { onEdit(); setOpen(false); }}><Icon name="edit" size={15} className="text-mute" />{editing ? "Finish editing sidebar" : "Edit sidebar"}</button>
          <button role="menuitem" className={item} onClick={() => { onReset(); setOpen(false); }}><Icon name="undo" size={15} className="text-mute" />Reset sidebar order</button>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className={item}><Icon name="settings" size={15} className="text-mute" />Settings</Link>
          <button role="menuitem" className={item} onClick={() => { openHelp(); setOpen(false); }}><Icon name="keyboard" size={15} className="text-mute" />Keyboard shortcuts</button>
          {hiddenPages.length > 0 && <><div className="mx-2 my-1.5 border-t" /><div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-dim">More pages</div>
            {hiddenPages.map((p) => <Link key={p.href} role="menuitem" href={p.href} onClick={() => setOpen(false)} className={item}><Icon name={p.icon} size={15} className="text-mute" />{p.label}</Link>)}</>}
        </div>
      )}
    </div>
  );
}
