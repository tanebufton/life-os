"use client";
import { resetMobileTabs, resetTodayWidgets, saveMobileTabs, saveTodayWidgets } from "@/lib/actions";
import { OrderList, type OrderItem } from "./orderlist";

export function MobileTabsEditor({ items }: { items: OrderItem[] }) {
  return <OrderList items={items} max={4} preview hint="Tick the pages you want in the bottom bar and use the arrows to reorder. “More” is always the last tab." save={async (_o, on) => { await saveMobileTabs(on); }} onReset={resetMobileTabs} />;
}
export function TodayWidgetsEditor({ items }: { items: OrderItem[] }) {
  return <OrderList items={items} hint="Choose what appears in Today's side column and in what order." save={async (order, on) => { await saveTodayWidgets(order, order.filter((i) => !on.includes(i))); }} onReset={resetTodayWidgets} />;
}
