import type { FeatureKey } from "./features";
export type WidgetDef = { id: string; label: string; feature?: FeatureKey; anyOf?: FeatureKey[] };
/** A widget shows only if its feature is on (and, where set, at least one of the views it belongs to). */
export const widgetOn = (w: WidgetDef, on: (f: FeatureKey) => boolean) => (!w.feature || on(w.feature)) && (!w.anyOf || w.anyOf.some(on));
/** Everything that can appear in Today's side column, in the default order. Feature-gated ones vanish when the feature is off. */
export const WIDGETS: WidgetDef[] = [
  { id: "glance", label: "Today at a glance" }, { id: "events", label: "Calendar events", feature: "calendar", anyOf: ["upcoming", "planner"] }, { id: "habits", label: "Habits", feature: "habits" }, { id: "journal", label: "Journal check-in", feature: "journal" },
  { id: "money", label: "Money this month", feature: "money" }, { id: "subs", label: "Upcoming renewals", feature: "subscriptions" }, { id: "people", label: "People & birthdays", feature: "people" }, { id: "goals", label: "Goals", feature: "goals" },
  { id: "weather", label: "Weather", feature: "weather" }, { id: "music", label: "Now playing", feature: "music" }, { id: "news", label: "Headlines", feature: "news" },
];
/** Saved value: JSON {order: string[], hidden: string[]}. New widgets that aren't in `order` yet are appended in default position. */
export function resolveWidgets(saved: string | undefined, on: (f: FeatureKey) => boolean): string[] {
  let order: string[] = [], hidden: string[] = [];
  try { const p = saved ? JSON.parse(saved) : null; if (p) { order = Array.isArray(p.order) ? p.order : []; hidden = Array.isArray(p.hidden) ? p.hidden : []; } } catch { /* defaults */ }
  const ids = WIDGETS.map((w) => w.id);
  const full = [...order.filter((i) => ids.includes(i)), ...ids.filter((i) => !order.includes(i))];
  return full.filter((i) => !hidden.includes(i) && widgetOn(WIDGETS.find((x) => x.id === i)!, on));
}
