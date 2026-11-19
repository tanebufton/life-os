# LifeOS

A personal, single-user life dashboard: tasks, habits, journal, focus, news, weather and music in one place.
Next.js 15 + SQLite (better-sqlite3). Self-hosted, with a REST API, an MCP server and a background worker.

## Deploy
Docker Compose + Cloudflare Tunnel + Access: see **[docs/DEPLOY.md](docs/DEPLOY.md)** (specs, setup, updates, recovery).

## Run
```bash
npm install
npm run dev                      # http://127.0.0.1:3000
npm run build && npm start       # production, binds 127.0.0.1
npm run worker                   # reminders, morning brief, IMAP email import (optional, keep it running)
npm run mcp                      # MCP server for Claude and other bots (optional)
LIFEOS_DB=data/demo.db npm run seed   # fill a demo database
```
Data lives in `data/lifeos.db` (override with `LIFEOS_DB`). Back it up from **Settings → Your data**.

## Switch features on and off
**Settings → Features.** Everything except Today, Inbox, My tasks and Settings can be turned off: Upcoming, Board, Plan & review,
Insights, Habits, Journal, Focus, Planner, Notes, Goals, People, Templates, Budgets, Subscriptions, Calendar sync, Telegram, the AI assistant (off by default), News, Weather, Music, Email import, Reminders, REST API. A switched-off feature disappears from the
sidebar, mobile nav, command palette, shortcuts, Today, the MCP tools, the REST API and the worker. Data is kept if you turn it back on.

## What's in it
**Tasks:** projects, tags, priority, due date **and time**, **estimates**, repeats, **subtasks/checklists** (recurring checklists reset),
quick-add syntax (`Pay rent every month #bills @home !high 31 march at 9am ~30m`), soft-delete with **Undo** (30 days), duplicate.
**Views:** Today (with workload meter), **Inbox**, **Upcoming** (agenda + month), My tasks, Board, **Search** with operators
(`#tag @project due:week is:done no:date has:link source:email`), **Plan your day / weekly review** (one-tap triage), **Insights**
(heatmap, streaks, focus), **Habits** (streaks that skip unscheduled days), **Journal** (mood + daily note).
**Speed:** `⌘K` palette (searches tasks too), `C` capture, `J/K/X/E/T/W/#` in lists, `?` for help, hover quick-reschedule.
**Phone:** installable PWA, share-sheet "Share to LifeOS", bottom tab bar, floating `+`.

**Money:** monthly **budgets** per category (default + per-month overrides), transactions, `$12.50 coffee` quick-add from anywhere, rules that auto-categorise by payee, **bank CSV import** (delimiter/date/debit-credit detection, de-duplicated), month projection and threshold alerts, savings goals. **Subscriptions:** cycle maths, auto-logged renewals, free-trial and renewal reminders, price-rise detection, monthly/yearly totals.
**Planning & life:** **Planner** (time-blocking timeline, auto-schedule into free slots, synced calendar events), **Notes** (Markdown, `[[links]]`, backlinks), **Goals** with key results, **People** (catch-up cadence, birthdays), **Templates** (one click makes a task with its checklist), **Do this now**, **Priority matrix**, **Trash**, saved filters, bulk select, task comments, link-title enrichment, voice capture (where the browser supports it), quiet hours.
**Customise:** Settings → Layout picks the (up to 4) tabs in the phone's bottom bar and the order of Today's side panels.

## Integrations
| What | How |
|---|---|
| **Claude / MCP** | `LIFEOS_MCP_TOKEN=$(openssl rand -hex 24) npm run mcp`, then `tailscale serve --bg --https=8443 http://127.0.0.1:3737` and `claude mcp add --transport http lifeos https://<machine>.<tailnet>.ts.net:8443/mcp --header "Authorization: Bearer <token>"`. 30 tools; they follow the feature switches. Never use `tailscale funnel`. |
| **REST API** | Settings → API & calendar feed → create a token. `POST /api/v1/tasks {"text":"Call mum tomorrow at 5pm"}`, `GET /api/v1/tasks?q=`, `PATCH/DELETE /api/v1/tasks/:id`, `POST /api/v1/tasks/:id/complete`, `/search`, `/brief`, `/habits`, `/journal`. Good for iOS Shortcuts and scripts. |
| **Email to tasks** | Webhook: POST any email (Postmark, Mailgun, SendGrid, JSON, or raw RFC 822 from a Cloudflare Email Worker) to the URL in Settings. Or IMAP: set `LIFEOS_IMAP_HOST/USER/PASS` (+ `_MAILBOX`, `_FLAGGED_ONLY=1`) and run the worker. Subject accepts quick-add syntax; `tasks+work@` adds the tag `work`; duplicates are skipped. |
| **Calendar** | Subscribe to the iCal URL in Settings from Google/Apple/Outlook. Repeats come through as RRULEs. |
| **Push** | ntfy topic and/or any webhook in Settings; due-time reminders, morning brief, evening habit nudge. Needs `npm run worker` and `LIFEOS_BASE_URL` for tap-through links. |
| **Calendar sync** | Settings → Calendar sync: paste a private `.ics` link (Google: "Secret address in iCal format"). Read-only, refreshed by the worker every ~15 min. |
| **Telegram** | Create a bot with @BotFather, paste the token in Settings → Telegram, press Connect webhook (needs a public HTTPS URL), send the shown `/start <code>` to link your chat. Only that chat is answered. Free text adds a task; `/today /inbox /done 12 /search /brief /habits /spent 12 coffee /subs`. |
| **AI assistant** | Off by default. Set `ANTHROPIC_API_KEY`, switch it on in Settings; smart paste, plan-my-day and ask. Model `claude-opus-5-5` (override `LIFEOS_AI_MODEL`). Text is sent to Anthropic only when you press a button. |
| **Voice memos / Chrome extension** | `/voice` records speech (browser speech recognition) into a memo, task or note. `extension/` is an unpacked Chrome extension: toolbar icon or Alt+Shift+V opens a recorder window that POSTs text to `/api/v1/voice`. See `extension/README.md`. |
| **Spotify** | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `LIFEOS_BASE_URL`; Premium needed for control. |

## Backup to Cloudflare R2
Settings → Backup. In Cloudflare: **R2 → Create bucket**, then **Manage R2 API tokens → Create token** with *Object Read & Write* limited to that bucket. Paste the account ID, bucket, access key ID and secret, and choose an **encryption passphrase** (write it down: without it a backup can't be opened). Press *Test connection*, then *Back up now & verify*.
Each backup is a consistent snapshot (`VACUUM INTO`), integrity-checked, gzip'd, encrypted with AES-256-GCM (key from scrypt) and uploaded, then **downloaded again and verified** before it counts. Nothing is ever deleted unless the new backup verified. The worker (`npm run worker`) repeats it on your schedule, keeps the newest N, and sends a push if one fails.
**Restore** swaps your data for a backup inside a single SQLite transaction (a failure rolls back completely), after saving your current data as `data/pre-restore-*.db` so you can **Undo**. Your backup credentials are kept across a restore. To recover on a new machine: set `LIFEOS_BACKUP_ENDPOINT/BUCKET/KEY_ID/SECRET/PASSPHRASE` in the environment, start LifeOS, and Restore from Settings.

## Auth
No login in the app: put it behind Cloudflare Tunnel + Access and set `LIFEOS_REQUIRE_CF_ACCESS=1` to 403 anything without the Access
identity header. `/api/v1`, `/api/inbound` and `/api/ical` use their own token/secret, so add an Access bypass policy for those paths.

## Design
Light/dark (follows your system), Inter, Lucide icons, Sonner toasts. Patterns from Notion, Todoist, Jira, Stripe, WhatsApp/Messenger.
