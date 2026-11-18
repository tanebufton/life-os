import type { FeatureKey } from "./features";
export type NavPage = { href: string; label: string; icon: string; key: string; feature?: FeatureKey; group: "main" | "life" | "explore" };
export const NAV: NavPage[] = [
  { href: "/inbox", label: "Inbox", icon: "inbox", key: "i", group: "main" },
  { href: "/", label: "Today", icon: "today", key: "t", group: "main" },
  { href: "/upcoming", label: "Upcoming", icon: "upcoming", key: "u", feature: "upcoming", group: "main" },
  { href: "/tasks", label: "My tasks", icon: "list", key: "l", group: "main" },
  { href: "/board", label: "Board", icon: "board", key: "b", feature: "board", group: "main" },
  { href: "/habits", label: "Habits", icon: "habits", key: "h", feature: "habits", group: "life" },
  { href: "/journal", label: "Journal", icon: "journal", key: "j", feature: "journal", group: "life" },
  { href: "/focus", label: "Focus", icon: "focus", key: "f", feature: "focus", group: "life" },
  { href: "/review", label: "Plan & review", icon: "review", key: "r", feature: "review", group: "explore" },
  { href: "/insights", label: "Insights", icon: "insights", key: "x", feature: "insights", group: "explore" },
  { href: "/news", label: "News", icon: "news", key: "n", feature: "news", group: "explore" },
];
export const SETTINGS_PAGE: NavPage = { href: "/settings", label: "Settings", icon: "settings", key: "s", group: "main" };
export type Features = Record<FeatureKey, boolean>;
export const visiblePages = (f: Features) => NAV.filter((p) => !p.feature || f[p.feature]);
