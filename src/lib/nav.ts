import type { FeatureKey } from "./features";
export type NavPage = { href: string; label: string; icon: string; key: string; feature?: FeatureKey; group: "main" | "life" | "explore"; hidden?: boolean; project?: { color: string; icon?: string | null } };
export const NAV: NavPage[] = [
  { href: "/inbox", label: "Inbox", icon: "inbox", key: "i", group: "main" },
  { href: "/", label: "Today", icon: "today", key: "t", group: "main" },
  { href: "/upcoming", label: "Upcoming", icon: "upcoming", key: "u", feature: "upcoming", group: "main" },
  { href: "/tasks", label: "My tasks", icon: "list", key: "l", group: "main" },
  { href: "/board", label: "Board", icon: "board", key: "b", feature: "board", group: "main" },
  { href: "/planner", label: "Planner", icon: "planner", key: "p", feature: "planner", group: "main", hidden: true },
  { href: "/focus", label: "Focus", icon: "focus", key: "f", feature: "focus", group: "life" },
  { href: "/notes", label: "Notes", icon: "notes", key: "o", feature: "notes", group: "life" },
  { href: "/goals", label: "Goals", icon: "goals", key: "a", feature: "goals", group: "life" },
  { href: "/templates", label: "Templates", icon: "templates", key: "k", feature: "templates", group: "explore" },
  { href: "/matrix", label: "Priority matrix", icon: "matrix", key: "q", feature: "board", group: "explore", hidden: true },
  { href: "/now", label: "Do this now", icon: "now", key: "w", group: "explore", hidden: true },
  { href: "/assistant", label: "Assistant", icon: "sparkles", key: "z", feature: "ai", group: "explore" },
  { href: "/tags", label: "Tags", icon: "inbox", key: "d", group: "explore" },
  { href: "/activity", label: "Activity", icon: "clock", key: "g", group: "explore" },
  { href: "/trash", label: "Trash", icon: "trash", key: "y", group: "explore", hidden: true },
  { href: "/review", label: "Plan & review", icon: "review", key: "r", feature: "review", group: "life" },
  { href: "/insights", label: "Insights", icon: "insights", key: "x", feature: "insights", group: "explore" },
];
export const SETTINGS_PAGE: NavPage = { href: "/settings", label: "Settings", icon: "settings", key: "s", group: "main" };
export type Features = Record<FeatureKey, boolean>;
export const visiblePages = (f: Features) => NAV.filter((p) => !p.feature || f[p.feature]);

export const MAX_TABS = 4;
/** The user's chosen bottom-bar tabs (up to 4), falling back to sensible defaults. Only pages whose feature is on can appear. */
export type TabProject = { id: number; name: string; color: string; icon?: string | null };
export function resolveTabs(saved: string | undefined, f: Features, projects: TabProject[] = []): NavPage[] {
  const vis = [...visiblePages(f), ...projects.map((p) => projectTab(p))];
  let hrefs: string[] = [];
  try { const p = saved ? JSON.parse(saved) : null; if (Array.isArray(p)) hrefs = p.filter((x) => typeof x === "string"); } catch { /* use defaults */ }
  const chosen = hrefs.map((h) => vis.find((p) => p.href === h)).filter(Boolean) as NavPage[];
  if (saved && chosen.length) return chosen.slice(0, MAX_TABS);
  const pick = (h: string) => vis.find((p) => p.href === h);
  return [pick("/"), pick("/inbox"), pick("/tasks"), pick("/upcoming") ?? pick("/board")].filter(Boolean) as NavPage[];
}

/** A project can sit in the phone bar like a page does. */
export const projectTab = (p: TabProject): NavPage => ({ href: `/projects/${p.id}`, label: p.name, icon: "list", key: "", group: "main", project: { color: p.color, icon: p.icon } });
