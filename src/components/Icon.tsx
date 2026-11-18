import { ArrowRight, Calendar, CalendarCheck, Check, ChevronDown, ChevronRight, ChevronsUp, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, CircleCheck, Columns3, Inbox, ListChecks, Moon, Music, Pause, Play, Plus, Repeat, Rss, Search, SkipBack, SkipForward, SlidersHorizontal, Sun, Timer, X, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  today: CalendarCheck, calendar: Calendar, list: ListChecks, board: Columns3, focus: Timer, news: Rss, settings: SlidersHorizontal,
  plus: Plus, search: Search, repeat: Repeat, check: Check, chevRight: ChevronRight, chevDown: ChevronDown, chevUp2: ChevronsUp, chevDown1: ChevronDown,
  prev: SkipBack, next: SkipForward, play: Play, pause: Pause, music: Music, arrow: ArrowRight, x: X, inbox: Inbox, circleCheck: CircleCheck, moon: Moon,
  sun: Sun, partly: CloudSun, cloud: Cloud, rain: CloudRain, snow: CloudSnow, storm: CloudLightning, fog: CloudFog,
};
const FILLED = new Set(["prev", "next", "play", "pause"]);
export function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  const C = MAP[name] ?? Cloud;
  return <C size={size} strokeWidth={1.8} className={`shrink-0 ${className}`} fill={FILLED.has(name) ? "currentColor" : "none"} aria-hidden />;
}
