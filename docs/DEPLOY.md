# Deploying LifeOS

Docker Compose on any always-on machine, a Cloudflare Tunnel in front (no open ports), Cloudflare Access for login.

## What you need

Measured on the production build. "Idle" is a freshly started container in CI; "after use" is after browsing every page on a dev machine:

| Piece | Memory idle | Memory after use | Notes |
|---|---|---|---|
| `web` | ~110 MB | ~240 MB | Next.js server |
| `worker` | ~70 MB | ~140 MB | reminders, scheduled backups, calendar sync, subscription auto-logging, email polling |
| `mcp` (optional) | ~90 MB | ~150 MB | only if you connect Claude / MCP clients |
| `cloudflared` | small | not measured |

- **Runtime:** about **400 MB** for web + worker, about **550 MB** with MCP. A **1 GB** machine is fine, **2 GB** is comfortable.
- **Building the image on the server** peaked at **~800 MB**, so on a 1 GB machine pull the prebuilt image (below) instead of building.
- **CPU:** any modern single core is enough. One user, mostly idle. ARM works (Raspberry Pi 4/5, 64-bit OS): CI publishes `linux/arm64`.
- **Disk:** the image is **1.55 GB unpacked (302 MB to download)**, so allow **4 GB** for Docker plus the volume. The database itself is small (the seeded demo is ~240 KB; a few years of heavy use is tens of MB). SQLite needs a real disk (not a network share).
- **Network:** outbound only. No inbound ports, no public IP, no TLS to manage.
- **Cost:** a Raspberry Pi or old laptop you own is $0; a small VPS (1–2 GB) is roughly $4–6 a month. Cloudflare Tunnel and Access (free plan, up to 50 users) cost nothing. R2 backups are effectively free at this size.
- **Does not work:** Cloudflare Workers/Pages, Vercel or other serverless hosts (it needs a long-running process and a local disk).

## 1. On the server

```bash
# Docker + Compose installed. Then:
git clone https://github.com/<you>/life-os.git && cd life-os
cp .env.example .env        # fill in the values as you go below
```

### Pull the prebuilt image instead of building (small servers)
CI publishes `ghcr.io/<you>/life-os:latest` on every push to `main`. For a private repo the package is private too, so log in once with a GitHub token that has `read:packages`:
```bash
echo <token> | docker login ghcr.io -u <you> --password-stdin
echo 'LIFEOS_IMAGE=ghcr.io/<you>/life-os:latest' >> .env
docker compose pull
```

## 2. Cloudflare Tunnel
Zero Trust → **Networks → Tunnels → Create tunnel (Cloudflared)**. Copy the token into `.env` as `CLOUDFLARE_TUNNEL_TOKEN`. Add a **public hostname** (e.g. `life.example.com`) with service **HTTP → `web:3000`**. Put `LIFEOS_BASE_URL=https://life.example.com` in `.env`.

## 3. Cloudflare Access (the login)
Zero Trust → **Access → Applications → Add → Self-hosted**, for the same hostname, with a policy that allows only your email. Then:
- Copy the **Application Audience (AUD) tag** to `LIFEOS_CF_AUD`, and your team name (`<team>.cloudflareaccess.com`) to `LIFEOS_CF_TEAM_DOMAIN`. With these set, LifeOS verifies the signed Access token on every request, so nothing that reaches the app by another route can pretend to be you.
- **Session length:** set the application's session duration to what you like. When it ends, LifeOS keeps what you were typing, shows "Your session has expired", and saves automatically once you sign in again (it opens a new tab for that).
- **The most secure setup opens nothing.** Leave the Cloudflare hostname fully behind Access, add **no Bypass policies**, and use the options below for everything that can't sign in through a login page:

| Need | Don't open it publicly. Instead |
|---|---|
| Chrome extension, iOS Shortcuts, scripts, REST API | Use them over **Tailscale** (see below). `/api/v1/*` is blocked at Cloudflare Access (no policy), and reachable only on your tailnet |
| Telegram bot | Leave it on **Polling** (the default). The worker asks Telegram for messages, so no inbound URL exists |
| Email to tasks | Use **IMAP** (`LIFEOS_IMAP_*`), which is outbound only |
| Claude / MCP | Tailscale (already the recommended route) |
| Calendar in Google Calendar | Needs a public URL (Google fetches it). Either skip it, or open `/api/ical/*` alone. Apple/Outlook on a device that's on your tailnet can use the tailnet address |

If you do need a public path (Telegram webhook, the inbound email webhook, a public calendar feed), add a Bypass policy for **that one path only**. Every such path is protected as follows:

| Path | Protected by | Extra hardening |
|---|---|---|
| `/api/v1/*` | API token: stored hashed, scoped (read-only or read & write, limited to chosen areas), optional expiry, 120 requests/min per token | 10 bad tokens from an address locks it out for 10 minutes; 1 MB body cap; revocable |
| `/api/telegram/*` | URL secret **and** Telegram's secret-token header (both must match), only the linked chat is obeyed | webhook mode only; throttled; 200 KB cap |
| `/api/inbound/*` | secret (send it in the `x-lifeos-secret` header, not the URL) or a write-scoped token | throttled; 10 MB cap |
| `/api/ical/*` | secret in the URL, read-only | throttled; `Referrer-Policy: no-referrer`, `no-store` |

Responses are generic (a wrong secret is always a plain 404), nothing is allowed cross-origin, and every page sends `nosniff`, `no-referrer`, `frame-deny` and a microphone-only permissions policy.

## 4. Start
```bash
docker compose up -d --build          # or just `up -d` with a prebuilt image
docker compose ps                     # web should become "healthy"
docker compose --profile mcp up -d    # optional: the MCP server
```
Open your hostname, sign in through Access, then **Settings**: switch off features you don't want, set your timezone, and set up **Backup to Cloudflare R2** (press *Back up now & verify*). The worker runs the schedule.

## Tailscale for the API, extension and MCP
Install Tailscale on the host, then:
```bash
tailscale serve --bg --https=443 http://127.0.0.1:3000      # the app, on your tailnet only
```
Use `https://<machine>.<tailnet>.ts.net` as the address in the Chrome extension and in scripts. Requests that arrive this way carry no Cloudflare login token, so with `LIFEOS_CF_*` set **the web UI refuses them (403) while the token-authenticated `/api/v1/*` paths work**. That is intended: the UI is only reachable through Cloudflare Access, the API only through your tailnet. Use Tailscale ACLs to limit which devices can reach the host.
Don't skip Cloudflare Access and rely on the tailnet alone for the UI unless you trust every device on it: without `LIFEOS_CF_*` the UI has no login of its own.

## MCP (Claude and other bots) over Tailscale
Set `LIFEOS_MCP_TOKEN` (`openssl rand -hex 24`), start the `mcp` profile, then on the host:
```bash
tailscale serve --bg --https=8443 http://127.0.0.1:3737
claude mcp add --transport http lifeos https://<machine>.<tailnet>.ts.net:8443/mcp --header "Authorization: Bearer <token>"
```

## Updating
```bash
git pull && docker compose up -d --build     # or: docker compose pull && docker compose up -d
```
Database migrations run automatically on start. The data lives in the `lifeos-data` volume and survives updates.

## Backups and recovery
Primary protection is the R2 backup (encrypted, verified). To recover on a new machine: install as above, put `LIFEOS_BACKUP_ENDPOINT/BUCKET/KEY_ID/SECRET/PASSPHRASE` in `.env`, start it, open Settings → Backup, and **Restore**. Keep your passphrase somewhere safe: without it a backup can't be opened.
Local copy any time: `docker compose exec web node -e "require('better-sqlite3')('/data/lifeos.db').exec(\"VACUUM INTO '/data/copy.db'\")"`.

## Troubleshooting
- **403 Forbidden on every page:** the Access token isn't being verified. Check `LIFEOS_CF_TEAM_DOMAIN` (just the team name or the full `team.cloudflareaccess.com`) and `LIFEOS_CF_AUD`, and that the hostname is protected by that Access application.
- **"Invalid Server Actions request" / saves failing:** `LIFEOS_BASE_URL` must match the public hostname exactly.
- **Chrome extension can't reach it:** use the Tailscale address (above), or add a Service Auth policy for `/api/v1/*`.
- **Telegram bot silent:** the worker must be running (polling mode). Check `docker compose logs worker`.
- **"Too many requests" (429):** an address was locked out after 10 bad credentials, or a token passed 120 requests a minute (`LIFEOS_RATE_LIMIT_PER_MIN`). It clears by itself.
- **Container restarts, "unable to open database":** the volume must be writable by uid 1000 (`node`). With a bind mount: `chown 1000:1000 ./data`.
- **Logs:** `docker compose logs -f web worker`.
