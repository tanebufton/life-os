# LifeOS

Personal, single-user life dashboard. Next.js 15 + SQLite (better-sqlite3). v0: tasks & projects.

```bash
npm install
npm run dev          # http://127.0.0.1:3000
npm run build && npm start
```

- Data: `data/lifeos.db` (override with `LIFEOS_DB`). Back up that file.
- Auth: none in-app. Binds to 127.0.0.1; put it behind a Cloudflare Tunnel + Access.
  Set `LIFEOS_REQUIRE_CF_ACCESS=1` to 403 any request lacking the Access identity header.

## MCP server (Tailscale)

```bash
LIFEOS_MCP_TOKEN=$(openssl rand -hex 24) npm run mcp   # 127.0.0.1:3737/mcp
tailscale serve --bg --https=8443 http://127.0.0.1:3737   # tailnet-only HTTPS, no public exposure
claude mcp add --transport http lifeos https://<machine>.<tailnet>.ts.net:8443/mcp --header "Authorization: Bearer <token>"
```

Tools: add_task, list_tasks, update_task, complete_task, delete_task, list_projects, add_project.
Never use `tailscale funnel` for this; that makes it public.
