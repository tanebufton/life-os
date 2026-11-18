// Feature registry. Everything except the core (tasks, Today, Inbox, Settings) can be switched off.
import { getSetting, setSetting } from "./settings";

export const FEATURES = [
  { key: "upcoming", label: "Upcoming & calendar", desc: "Agenda and month view of everything due.", group: "Views" },
  { key: "board", label: "Board", desc: "Kanban columns: To do, In progress, Done.", group: "Views" },
  { key: "review", label: "Plan & review", desc: "Plan your day, triage overdue tasks, weekly review.", group: "Views" },
  { key: "insights", label: "Insights", desc: "Completion heatmap, streaks and focus stats.", group: "Views" },
  { key: "habits", label: "Habits", desc: "Daily habits with streaks and heatmaps.", group: "Life" },
  { key: "journal", label: "Journal", desc: "A daily note with a mood check-in.", group: "Life" },
  { key: "focus", label: "Focus & timers", desc: "Pomodoro, timers and focus history.", group: "Life" },
  { key: "news", label: "News", desc: "Headlines from your RSS feeds.", group: "Widgets" },
  { key: "weather", label: "Weather", desc: "Forecast card on Today.", group: "Widgets" },
  { key: "music", label: "Music", desc: "Spotify now-playing and controls.", group: "Widgets" },
  { key: "email", label: "Email import", desc: "Turn forwarded or flagged emails into tasks.", group: "Integrations" },
  { key: "reminders", label: "Reminders & push", desc: "Due-time reminders and a morning brief via ntfy or a webhook.", group: "Integrations" },
  { key: "api", label: "REST API & calendar feed", desc: "Tokens for bots and shortcuts, plus an iCal subscription.", group: "Integrations" },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];
export const isFeature = (k: string): k is FeatureKey => FEATURES.some((f) => f.key === k);
export const isOn = (k: FeatureKey): boolean => getSetting(`feature.${k}`) !== "0";
export function setFeature(k: FeatureKey, on: boolean) { setSetting(`feature.${k}`, on ? "1" : "0"); }
export function featureMap(): Record<FeatureKey, boolean> {
  return Object.fromEntries(FEATURES.map((f) => [f.key, isOn(f.key)])) as Record<FeatureKey, boolean>;
}
