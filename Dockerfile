# syntax=docker/dockerfile:1
# One image runs everything: the web app (default), the worker, and the MCP server (see docker-compose.yml).
# Built in stages so each slow part is cached on its own:
#   deps-all - every dependency, installed once (rebuilt only when package-lock.json changes)
#   deps     - the same with dev packages removed (also only when package-lock.json changes)
#   build    - the Next.js build (rebuilt when the source changes)
#   final    - a small runtime image assembled from deps and build
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# One network install, shared by both stages below (two parallel installs competed for CPU on small servers and each took twice as long).
FROM base AS deps-all
COPY package.json package-lock.json ./
# better-sqlite3 ships a prebuilt binary for common platforms, so no compiler is needed. If there isn't one, install a compiler and try again.
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --prefer-offline \
 || (apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/* && npm ci --no-audit --no-fund)

# Production dependencies only: the same install with the dev packages taken out (no network, a few seconds, cached until package-lock.json changes).
# The Next.js compilers (@next/swc-*, ~270 MB, a third of node_modules) are only used by `next build`, never by `next start`, so the runtime image leaves them out.
FROM deps-all AS deps
RUN npm prune --omit=dev --no-audit --no-fund && rm -rf node_modules/@next/swc-*

FROM deps-all AS build
COPY . .
# Types are already checked before every commit, so the server skips that slow step (see next.config.mjs).
ENV LIFEOS_FAST_BUILD=1
# The cache mount keeps Next.js's compile cache between builds, so a small change rebuilds only what it touched.
# Next.js makes a new random Server Actions key on every build inside Docker, and that key is part of the compile cache's version, so the cache
# was thrown away every time and each update compiled from scratch. Keeping one key in the cache mount (renewed every 14 days, as Next.js does
# outside Docker) makes the cache hit. The key ends up in the built image either way, so it is no more exposed than before.
RUN --mount=type=cache,target=/app/.next/cache \
    k=.next/cache/server-actions.key; find "$k" -mtime +14 -delete 2>/dev/null; \
    [ -s "$k" ] || node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))" > "$k"; \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat "$k")" npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 LIFEOS_DB=/data/lifeos.db HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/mcp ./mcp
COPY --from=build --chown=node:node /app/extension ./extension
COPY --from=build --chown=node:node /app/package.json /app/next.config.mjs /app/tsconfig.json ./
RUN mkdir -p /data && chown node:node /data
# Which commit this image was built from (update.sh uses it to know whether a rebuild is needed). Kept last so it never invalidates the cache.
ARG GIT_COMMIT=unknown
LABEL lifeos.commit=$GIT_COMMIT
VOLUME /data
USER node
EXPOSE 3000
# While starting, check every second (not every 30s), so the worker and tunnel, which wait for web to be healthy, start as soon as it is up instead of ~30s later.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --start-interval=1s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
