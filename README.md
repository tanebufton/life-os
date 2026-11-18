# LifeOS

Personal, single-user life dashboard. Next.js 15 + SQLite (better-sqlite3), plus an MCP server so Claude can drive it.

## What's in it
- **Tasks** with projects, tags, priorities, due dates and **repeating** tasks (daily, weekdays, weekly, monthly, yearly, every N days).
  Completing a repeating task logs a history copy and rolls the original to its next date (overdue repeats skip forward, no pile-up).
- **Quick add** understands plain text: `Pay rent every month #bills @home !high tomorrow`
  (`#tag`, `@project`, `!high` `!low` `!doing`, `today` `tomorrow` `friday` `in 3 days` `2026-12-01`, `daily` `weekdays` `every 2 weeks`).
- **Kanban board** (To do / Doing / Done): drag and drop on desktop, arrow buttons on touch.
- **Focus**: pomodoro (editable durations, logs sessions, tab-title countdown, survives reloads) and free timers, with weekly stats.
- **Weather** (Open-Meteo, no key), **News** (RSS/Atom feeds you manage), **Spotify** controller (needs your own Spotify app + Premium).
- **MCP server** exposing all of the above (see below).

## Run
```bash
npm install
npm run dev                      # http://127.0.0.1:3000
npm run build && npm start       # production, binds 127.0.0.1
```
Then open **Settings**: set your city (also sets the timezone, which decides what "today" means) and manage feeds.
Data lives in `data/lifeos.db` (override with `LIFEOS_DB`). Back that file up.

## Auth
None in-app. Put it behind Cloudflare Tunnel + Access. Set `LIFEOS_REQUIRE_CF_ACCESS=1` to 403 any request that lacks the Access identity header.

## Spotify
1. Create an app at developer.spotify.com and add the redirect URI shown on the Settings page (`$LIFEOS_BASE_URL/api/spotify/callback`; must be https or 127.0.0.1).
2. Set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `LIFEOS_BASE_URL`, restart, then Settings → Connect Spotify.
Playback control requires Premium and an active device. (Implemented but not yet tested against the live Spotify API.)

## MCP server (Tailscale)
```bash
LIFEOS_MCP_TOKEN=$(openssl rand -hex 24) npm run mcp          # 127.0.0.1:3737/mcp
tailscale serve --bg --https=8443 http://127.0.0.1:3737       # tailnet-only HTTPS
claude mcp add --transport http lifeos https://<machine>.<tailnet>.ts.net:8443/mcp --header "Authorization: Bearer <token>"
```
Never use `tailscale funnel` for this; that makes it public.

Tools: `quick_add` `add_task` `list_tasks` `update_task` `move_task` `complete_task` `delete_task` `list_projects` `add_project` `list_tags`
`get_weather` `get_news` `spotify_now_playing` `spotify_control` `log_focus` `focus_stats` `daily_brief`
