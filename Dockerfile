# syntax=docker/dockerfile:1
# One image runs everything: the web app (default), the worker, and the MCP server (see docker-compose.yml).
# Built in three stages so BuildKit can do the slow parts side by side and cache each one on its own:
#   deps  - production node_modules (rebuilt only when package-lock.json changes)
#   build - all dependencies + the Next.js build (rebuilt when the source changes)
#   final - a small runtime image assembled from the two
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
# better-sqlite3 ships a prebuilt binary for common platforms, so no compiler is needed. If there isn't one, install a compiler and try again.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev \
 || (apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/* && npm ci --omit=dev)

FROM base AS build
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci \
 || (apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/* && npm ci)
COPY . .
# Types are already checked before every commit, so the server skips that slow step (see next.config.mjs).
ENV LIFEOS_FAST_BUILD=1
# The cache mount keeps Next.js's compile cache between builds, so a small change rebuilds only what it touched.
RUN --mount=type=cache,target=/app/.next/cache npm run build

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
VOLUME /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
