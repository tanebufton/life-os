#!/usr/bin/env bash
# One command to update a Docker install: ./update.sh
# Pulls the latest code, builds the image once (web, worker and mcp share it), restarts what changed, and clears old images.
set -euo pipefail
cd "$(dirname "$0")"
start=$(date +%s)
before=$(git rev-parse HEAD)
git pull --ff-only
after=$(git rev-parse HEAD)
export DOCKER_BUILDKIT=1
if [ "$before" = "$after" ] && docker image inspect "${LIFEOS_IMAGE:-life-os:local}" >/dev/null 2>&1 && [ "${1:-}" != "--rebuild" ]; then
  echo "Already up to date, nothing to build. (Use ./update.sh --rebuild to force one.)"
else
  t=$(date +%s)
  docker compose build web
  echo "Built in $(( $(date +%s) - t ))s."
fi
docker compose --profile mcp up -d --remove-orphans
docker image prune -f >/dev/null
echo "Done in $(( $(date +%s) - start ))s. Running:"; docker compose ps
