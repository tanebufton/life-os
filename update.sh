#!/usr/bin/env bash
# One command to update a Docker install: ./update.sh
# Pulls the latest code, builds the image once (web, worker and mcp share it), restarts what changed, and clears old images.
set -euo pipefail
cd "$(dirname "$0")"
start=$(date +%s)
git pull --ff-only
export DOCKER_BUILDKIT=1
docker compose build web
docker compose --profile mcp up -d --remove-orphans
docker image prune -f >/dev/null
echo "Updated in $(( $(date +%s) - start ))s. Running:"; docker compose ps
