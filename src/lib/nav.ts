import type { FeatureKey } from "./features";
export type NavPage = { href: string; label: string; icon: string; key: string; feature?: FeatureKey; group: "main" | "life" | "explore" | "money"; hidden?: boolean };
export const NAV: NavPage[] = [
  { href: "/inbox", label: "Inbox", icon: "inbox", key: "i", group: "main" },
  { href: "/", label: "Today", icon: "today", key: "t", group: "main" },
  { href: "/upcoming", label: "Upcoming", icon: "upcoming", key: "u", feature: "upcoming", group: "main" },
  { href: "/tasks", label: "My tasks", icon: "list", key: "l", group: "main" },
  { href: "/board", label: "Board", icon: "board", key: "b", feature: "board", group: "main" },
  { href: "/planner", label: "Planner", icon: "planner", key: "p", feature: "planner", group: "main" },
  { href: "/habits", label: "Habits", icon: "habits", key: "h", feature: "habits", group: "life" },
  { href: "/journal", label: "Journal", icon: "journal", key: "j", feature: "journal", group: "life" },
  { href: "/focus", label: "Focus", icon: "focus", key: "f", feature: "focus", group: "life" },
  { href: "/notes", label: "Notes", icon: "notes", key: "o", feature: "notes", group: "life" },
  { href: "/goals", label: "Goals", icon: "goals", key: "a", feature: "goals", group: "life" },
  { href: "/people", label: "People", icon: "people", key: "e", feature: "people", group: "life" },
  { href: "/money", label: "Budget", icon: "wallet", key: "m", feature: "money", group: "money" },
  { href: "/subscriptions", label: "Subscriptions", icon: "subs", key: "c", feature: "subscriptions", group: "money" },
  { href: "/templates", label: "Templates", icon: "templates", key: "k", feature: "templates", group: "explore" },
  { href: "/matrix", label: "Priority matrix", icon: "matrix", key: "q", feature: "board", group: "explore", hidden: true },
  { href: "/now", label: "Do this now", icon: "now", key: "w", group: "explore", hidden: true },
  { href: "/assistant", label: "Assistant", icon: "sparkles", key: "z", feature: "ai", group: "explore" },
  { href: "/trash", label: "Trash", icon: "trash", key: "y", group: "explore", hidden: true },
  { href: "/review", label: "Plan & review", icon: "review", key: "r", feature: "review", group: "explore" },
  { href: "/insights", label: "Insights", icon: "insights", key: "x", feature: "insights", group: "explore" },
  { href: "/news", label: "News", icon: "news", key: "n", feature: "news", group: "explore" },
];
export const SETTINGS_PAGE: NavPage = { href: "/settings", label: "Settings", icon: "settings", key: "s", group: "main" };
export type Features = Record<FeatureKey, boolean>;
export const visiblePages = (f: Features) => NAV.filter((p) => !p.feature || f[p.feature]);

export const MAX_TABS = 4;
/** The user's chosen bottom-bar tabs (up to 4), falling back to sensible defaults. Only pages whose feature is on can appear. */
export function resolveTabs(saved: string | undefined, f: Features): NavPage[] {
  const vis = visiblePages(f);
  let hrefs: string[] = [];
  try { const p = saved ? JSON.parse(saved) : null; if (Array.isArray(p)) hrefs = p.filter((x) => typeof x === "string"); } catch { /* use defaults */ }
  const chosen = hrefs.map((h) => vis.find((p) => p.href === h)).filter(Boolean) as NavPage[];
  if (saved && chosen.length) return chosen.slice(0, MAX_TABS);
  const pick = (h: string) => vis.find((p) => p.href === h);
  return [pick("/"), pick("/inbox"), pick("/tasks"), pick("/upcoming") ?? pick("/board")].filter(Boolean) as NavPage[];
}
