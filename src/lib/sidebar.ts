import { NAV, type NavPage } from "./nav";

export type SidebarPrefs = { order: string[]; hidden: string[]; shown: string[]; groups: string[] };
export type GroupKey = NavPage["group"] | "projects";
/** "projects" has no pages of its own: it stands for Favourites + the project list, so it can be ordered like any other section. */
export const GROUPS: { key: GroupKey; title: string }[] = [{ key: "main", title: "" }, { key: "projects", title: "Projects" }, { key: "life", title: "Life" }, { key: "explore", title: "Explore" }];
export const EMPTY_PREFS: SidebarPrefs = { order: [], hidden: [], shown: [], groups: [] };
const strs = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : []);
/** Read the saved preference defensively: anything unknown or malformed is ignored, so a bad value can never empty the sidebar. */
export function parsePrefs(raw: string | null | undefined): SidebarPrefs {
  try {
    const j = raw ? JSON.parse(raw) : null; if (!j || typeof j !== "object") return EMPTY_PREFS;
    const known = new Set(NAV.map((p) => p.href)), groups = new Set(GROUPS.map((g) => g.key as string));
    return { order: strs(j.order).filter((h) => known.has(h)), hidden: strs(j.hidden).filter((h) => known.has(h) && h !== "/"), shown: strs(j.shown).filter((h) => known.has(h)), groups: strs(j.groups).filter((g) => groups.has(g)) };
  } catch { return EMPTY_PREFS; }
}
export type Arranged = { key: GroupKey; title: string; items: { page: NavPage; hidden: boolean }[] }[];
/** Pages in the user's order, grouped, each flagged hidden-or-not. Today can't be hidden. New pages added later fall at the end of their group. */
export function arrange(pages: NavPage[], prefs: SidebarPrefs): Arranged {
  const idx = (h: string) => { const i = prefs.order.indexOf(h); return i < 0 ? Number.MAX_SAFE_INTEGER : i; }, base = (h: string) => NAV.findIndex((p) => p.href === h);
  let gOrder: GroupKey[] = [...(prefs.groups as GroupKey[]), ...GROUPS.map((g) => g.key).filter((k) => !prefs.groups.includes(k))];
  // Saved orders from before Projects was a section: keep it right under the main pages instead of dropping it at the end.
  if (!prefs.groups.includes("projects")) { gOrder = gOrder.filter((k) => k !== "projects"); gOrder.splice(Math.max(0, gOrder.indexOf("main")) + 1, 0, "projects"); }
  return gOrder.map((k) => GROUPS.find((g) => g.key === k)!).map((g) => ({
    key: g.key, title: g.title,
    items: pages.filter((p) => (p.group as string) === g.key).sort((a, b) => idx(a.href) - idx(b.href) || base(a.href) - base(b.href)).map((page) => ({ page, hidden: page.href !== "/" && (prefs.hidden.includes(page.href) || (!!page.hidden && !prefs.shown.includes(page.href))) })),
  })).filter((g) => g.key === "projects" || g.items.length);
}
/** After a drag or toggle: keep the flat order list, plus explicit show/hide choices relative to each page's default. */
export function withVisibility(prefs: SidebarPrefs, page: NavPage, hide: boolean): SidebarPrefs {
  const h = new Set(prefs.hidden), s = new Set(prefs.shown);
  if (hide) { s.delete(page.href); if (!page.hidden) h.add(page.href); } else { h.delete(page.href); if (page.hidden) s.add(page.href); }
  return { ...prefs, hidden: [...h], shown: [...s] };
}
