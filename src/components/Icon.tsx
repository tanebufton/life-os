import { Mic, NotebookText, Trophy, Users, LayoutTemplate, Zap, Grid2x2, CalendarRange, ArrowRight, BarChart3, Bell, BookOpen, CalendarClock, CalendarDays, Copy, Download, Flame, Frown, Keyboard, Laugh, Link2, Mail, Meh, MoreHorizontal, Plug, Sparkles, Smile, Sunrise, Target, Trash2, ClipboardCheck, ExternalLink, Eye, KeyRound, Share2, Undo2, Wallet, Repeat2,  Calendar, CalendarCheck, Check, ChevronDown, ChevronRight, ChevronsUp, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, CircleCheck, Columns3, Inbox, ListChecks, Moon, Music, Pause, Play, Plus, Repeat, Rss, Search, SkipBack, SkipForward, SlidersHorizontal, Sun, Timer, X, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  today: CalendarCheck, calendar: Calendar, list: ListChecks, board: Columns3, focus: Timer, news: Rss, settings: SlidersHorizontal,
  plus: Plus, search: Search, repeat: Repeat, check: Check, chevRight: ChevronRight, chevDown: ChevronDown, chevUp2: ChevronsUp, chevDown1: ChevronDown,
  prev: SkipBack, next: SkipForward, play: Play, pause: Pause, music: Music, arrow: ArrowRight, x: X, inbox: Inbox, circleCheck: CircleCheck, moon: Moon,
  sun: Sun, partly: CloudSun, cloud: Cloud, rain: CloudRain, snow: CloudSnow, storm: CloudLightning, fog: CloudFog,
};
Object.assign(MAP, { upcoming: CalendarDays, habits: Target, journal: BookOpen, insights: BarChart3, review: ClipboardCheck, flame: Flame, mail: Mail, link: Link2, more: MoreHorizontal, copy: Copy, trash: Trash2,
  clock: CalendarClock, sunrise: Sunrise, bell: Bell, plug: Plug, sparkles: Sparkles, keyboard: Keyboard, download: Download, ext: ExternalLink, eye: Eye, key: KeyRound, share: Share2, undo: Undo2,
  mic: Mic, planner: CalendarRange, notes: NotebookText, goals: Trophy, people: Users, templates: LayoutTemplate, now: Zap, matrix: Grid2x2, wallet: Wallet, subs: Repeat2, mood1: Frown, mood2: Meh, mood3: Smile, mood4: Laugh, mood5: Sparkles });
const FILLED = new Set(["prev", "next", "play", "pause"]);
export function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  const C = MAP[name] ?? Cloud;
  return <C size={size} strokeWidth={1.8} className={`shrink-0 ${className}`} fill={FILLED.has(name) ? "currentColor" : "none"} aria-hidden />;
}
