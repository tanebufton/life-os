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
