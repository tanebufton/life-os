"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addProject } from "@/lib/actions";
import { NAV, SETTINGS_PAGE, visiblePages, type Features, type NavPage } from "@/lib/nav";
import { CaptureForm } from "./capture";
import { Icon } from "./Icon";
import { ProjectAvatar } from "./Pill";
import { ThemeToggle } from "./theme";

export type NavProject = { id: number; name: string; color: string; open: number };
export type Counts = { due: number; open: number; doing: number; inbox: number };

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
export const openPalette = () => window.dispatchEvent(new Event("lifeos:palette"));
export const openHelp = () => window.dispatchEvent(new Event("lifeos:help"));
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
export function Sidebar({ counts, projects, features }: { counts: Counts; projects: NavProject[]; features: Features }) {
  const path = usePathname();
  const [adding, setAdding] = useState(false);
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
  const section = (g: NavPage["group"], title?: string) => { const items = pages.filter((p) => p.group === g); return items.length ? <div className={title ? "mt-4" : ""}>{title && <div className="px-4 pb-1 text-xs font-semibold text-mute">{title}</div>}<div className="space-y-px px-2">{items.map(link)}</div></div> : null; };
  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r bg-side md:flex">
      <div className="px-2 pb-1 pt-2.5">
        <Link href="/" className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-raise">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-[5px] bg-accent text-[12px] font-bold text-ink">L</span>
          <span className="text-[14px] font-semibold">LifeOS</span><Icon name="chevDown" size={14} className="text-dim" />
        </Link>
      </div>
      <div className="space-y-px px-2">
        <button onClick={openPalette} className={`${row} w-full text-mute hover:bg-raise`}><Icon name="search" size={16} />Search<span className="ml-auto text-xs text-dim">⌘K</span></button>
        <button onClick={focusCapture} className={`${row} w-full font-medium text-accent hover:bg-accent/10`}><span className="grid h-4 w-4 place-items-center rounded-full bg-accent text-ink"><Icon name="plus" size={12} /></span>New task</button>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto pb-2">
        {section("main")}{section("life", "Life")}{section("explore", "Explore")}
        <div className="group mt-4 flex items-center justify-between px-4"><span className="text-xs font-semibold text-mute">Projects</span>
          <button onClick={() => setAdding((a) => !a)} aria-label="New project" className="rounded p-0.5 text-mute opacity-0 transition hover:bg-raise hover:text-fg group-hover:opacity-100 focus:opacity-100"><Icon name={adding ? "x" : "plus"} size={14} /></button></div>
        <div className="mt-1 space-y-px px-2">
          {adding && (
            <form action={async (fd) => { await addProject(fd); setAdding(false); }} className="mb-1 flex gap-1.5 px-1">
              <input name="name" required autoFocus placeholder="Project name" className="field !py-1" />
              <input type="color" name="color" defaultValue="#1877f2" aria-label="Colour" className="h-8 w-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5" />
            </form>
          )}
          {projects.map((p) => {
            const on = path === `/projects/${p.id}`;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className={`${row} ${on ? "bg-raise font-medium" : "text-fg/80 hover:bg-raise/70"}`}>
                <ProjectAvatar name={p.name} color={p.color} /><span className="flex-1 truncate">{p.name}</span>{p.open > 0 && <span className="text-xs text-dim">{p.open}</span>}
              </Link>
            );
          })}
          {!projects.length && !adding && <p className="px-2 py-1 text-xs text-dim">No projects yet.</p>}
        </div>
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
  return [[...NAV, SETTINGS_PAGE].find((p) => isActive(path, p.href))?.label ?? "LifeOS"];
}
export function Topbar({ today, projects }: { today: string; projects: NavProject[] }) {
  const path = usePathname();
  const c = crumbs(path, projects);
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-4 border-b bg-bg/85 px-4 backdrop-blur md:px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[14px] md:w-60">
        {c.map((x, i) => (<span key={i} className="flex min-w-0 items-center gap-1.5">{i > 0 && <span className="text-dim">/</span>}<span className={`truncate ${i === c.length - 1 ? "font-semibold" : "text-mute"}`}>{x}</span></span>))}
      </nav>
      <div className="mx-auto hidden w-full max-w-xl md:block"><CaptureForm today={today} variant="pill" /></div>
      <div className="ml-auto flex items-center md:w-60 md:justify-end"><button onClick={openPalette} aria-label="Search" className="rounded-md p-1.5 text-mute hover:bg-raise md:hidden"><Icon name="search" size={18} /></button></div>
    </header>
  );
}

export function MobileNav({ counts, features }: { counts: Counts; features: Features }) {
  const path = usePathname();
  const badge: Record<string, number> = { "/": counts.due, "/inbox": counts.inbox };
  const pick = (h: string) => NAV.find((p) => p.href === h && (!p.feature || features[p.feature]));
  const tabs = [pick("/"), pick("/inbox"), pick("/tasks"), pick("/upcoming") ?? pick("/board")].filter(Boolean) as NavPage[];
  const items = [...tabs, { href: "/more", label: "More", icon: "more", key: "", group: "main" } as NavPage];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {items.map((p) => {
        const on = isActive(path, p.href) || (p.href === "/more" && !tabs.some((t) => isActive(path, t.href)));
        return (
          <Link key={p.href} href={p.href} className={`flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium ${on ? "text-accent" : "text-mute"}`}>
            <span className="relative"><Icon name={p.icon} size={22} />{badge[p.href] ? <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">{badge[p.href]}</span> : null}</span>
            {p.label === "My tasks" ? "Tasks" : p.label}
          </Link>
        );
      })}
    </nav>
  );
}
