// Feature registry. Everything except the core (tasks, Today, Inbox, Settings) can be switched off.
import { getSetting, setSetting } from "./settings";

export const FEATURES = [
  { key: "upcoming", label: "Upcoming & calendar", desc: "Agenda and month view of everything due.", group: "Views" },
  { key: "board", label: "Board", desc: "Kanban columns: To do, In progress, Done.", group: "Views" },
  { key: "review", label: "Plan & review", desc: "Plan your day, triage overdue tasks, weekly review.", group: "Views" },
  { key: "insights", label: "Insights", desc: "Completion heatmap, streaks and focus stats.", group: "Views" },
  { key: "planner", label: "Day planner", desc: "A time-blocking timeline with auto-schedule and calendar events.", group: "Views" },
  { key: "templates", label: "Templates", desc: "Reusable checklists and routines, one click to create.", group: "Views" },
  { key: "voice", label: "Voice memos", desc: "Speak a thought; it becomes a memo, task or note. Works with the Chrome extension.", group: "Life" },
  { key: "goals", label: "Goals", desc: "Goals by life area, tied to projects and key results.", group: "Life" },
  { key: "notes", label: "Notes", desc: "Markdown notes with [[links]] and backlinks.", group: "Life" },
  { key: "focus", label: "Focus & timers", desc: "Pomodoro, timers and focus history.", group: "Life" },
  { key: "email", label: "Email import", desc: "Turn forwarded or flagged emails into tasks.", group: "Integrations" },
  { key: "reminders", label: "Reminders & push", desc: "Due-time reminders and a morning brief via ntfy or a webhook.", group: "Integrations" },
  { key: "api", label: "REST API & calendar feed", desc: "Tokens for bots and shortcuts, plus an iCal subscription.", group: "Integrations" },
  { key: "calendar", label: "Calendar sync", desc: "Show events from Google, Apple or Outlook calendars (read-only).", group: "Integrations" },
  { key: "telegram", label: "Telegram bot", desc: "Capture tasks and ask questions from a Telegram chat.", group: "Integrations" },
  { key: "ai", label: "AI assistant", desc: "Smart paste, day planning and questions, powered by Claude. Sends task text to Anthropic, so it is off until you turn it on.", group: "Integrations", defaultOn: false },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];
export const isFeature = (k: string): k is FeatureKey => FEATURES.some((f) => f.key === k);
const defaultOn = (k: FeatureKey) => (FEATURES.find((f) => f.key === k) as { defaultOn?: boolean }).defaultOn !== false;
export const isOn = (k: FeatureKey): boolean => { const v = getSetting(`feature.${k}`); return v === undefined ? defaultOn(k) : v !== "0"; };
export const featureDefault = defaultOn;
export function setFeature(k: FeatureKey, on: boolean) { setSetting(`feature.${k}`, on ? "1" : "0"); }
export function featureMap(): Record<FeatureKey, boolean> {
  return Object.fromEntries(FEATURES.map((f) => [f.key, isOn(f.key)])) as Record<FeatureKey, boolean>;
}
