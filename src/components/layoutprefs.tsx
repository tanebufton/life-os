"use client";
import { resetMobileTabs, resetTodayWidgets, saveMobileTabs, saveTodayWidgets } from "@/lib/actions";
import { useState } from "react";
import { resetSidebarAction, saveSidebarAction } from "@/lib/actions5";
import { arrange, withVisibility, type SidebarPrefs } from "@/lib/sidebar";
import type { NavPage } from "@/lib/nav";
import { Icon } from "./Icon";
import { OrderList, type OrderItem } from "./orderlist";

export function MobileTabsEditor({ items }: { items: OrderItem[] }) {
  return <OrderList items={items} max={4} preview hint="Tick the pages you want in the bottom bar and use the arrows to reorder. “More” is always the last tab." save={async (_o, on) => { await saveMobileTabs(on); }} onReset={resetMobileTabs} />;
}
export function TodayWidgetsEditor({ items }: { items: OrderItem[] }) {
  return <OrderList items={items} hint="Choose what appears in Today's side column and in what order." save={async (order, on) => { await saveTodayWidgets(order, order.filter((i) => !on.includes(i))); }} onReset={resetTodayWidgets} />;
}

/** The desktop sidebar's order and visibility, editable anywhere (including a phone). Same settings as "Edit sidebar" in the LifeOS menu. */
export function SidebarEditor({ pages, prefs: initial }: { pages: NavPage[]; prefs: SidebarPrefs }) {
  const [prefs, setPrefs] = useState(initial), groups = arrange(pages, prefs);
  const persist = (p: SidebarPrefs) => { setPrefs(p); void saveSidebarAction(p); };
  const bump = (gk: string, href: string, dir: -1 | 1) => { const g = groups.find((x) => x.key === gk)!.items.map((i) => i.page.href), i = g.indexOf(href), j = i + dir; if (j < 0 || j >= g.length) return; [g[i], g[j]] = [g[j], g[i]]; persist({ ...prefs, order: [...prefs.order.filter((h) => !g.includes(h)), ...g] }); };
  const bumpGroup = (gk: string, dir: -1 | 1) => { const k = groups.map((x) => x.key as string), i = k.indexOf(gk), j = i + dir; if (j < 0 || j >= k.length) return; [k[i], k[j]] = [k[j], k[i]]; persist({ ...prefs, groups: k }); };
  return (
    <div>
      <div className="space-y-4">{groups.map((g) => (
        <div key={g.key}>
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-mute"><span className="flex-1">{g.title || "Top"}</span>
            <button aria-label={`Move ${g.title || "top"} group up`} onClick={() => bumpGroup(g.key, -1)} className="rounded p-1 hover:bg-raise"><Icon name="chevDown" size={13} className="rotate-180" /></button><button aria-label={`Move ${g.title || "top"} group down`} onClick={() => bumpGroup(g.key, 1)} className="rounded p-1 hover:bg-raise"><Icon name="chevDown" size={13} /></button></div>
          <ul className="divide-y rounded-lg border">{g.items.map((i) => (
            <li key={i.page.href} className={`flex items-center gap-2.5 px-3 py-1.5 text-[14px] ${i.hidden ? "opacity-55" : ""}`}>
              <input type="checkbox" checked={!i.hidden} disabled={i.page.href === "/"} onChange={() => persist(withVisibility(prefs, i.page, !i.hidden))} aria-label={`Show ${i.page.label} in the sidebar`} className="h-4 w-4" />
              <Icon name={i.page.icon} size={16} className="text-mute" /><span className="flex-1 truncate">{i.page.label}</span>
              <button aria-label={`Move ${i.page.label} up`} onClick={() => bump(g.key, i.page.href, -1)} className="rounded p-1 text-mute hover:bg-raise"><Icon name="chevDown" size={14} className="rotate-180" /></button><button aria-label={`Move ${i.page.label} down`} onClick={() => bump(g.key, i.page.href, 1)} className="rounded p-1 text-mute hover:bg-raise"><Icon name="chevDown" size={14} /></button></li>))}</ul>
        </div>))}</div>
      <div className="mt-2 text-right"><button className="text-xs text-mute hover:text-fg" onClick={() => { setPrefs({ order: [], hidden: [], shown: [], groups: [] }); void resetSidebarAction(); }}>Reset to default</button></div>
    </div>
  );
}
