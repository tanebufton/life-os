#!/usr/bin/env bash
# One command to update a Docker install: ./update.sh
# Pulls the latest code, builds the image once (web, worker and mcp share it) if the code changed, restarts what changed, and clears old images.
set -euo pipefail
cd "$(dirname "$0")"
start=$(date +%s)
git pull --ff-only
export DOCKER_BUILDKIT=1 GIT_COMMIT=$(git rev-parse HEAD)
image="${LIFEOS_IMAGE:-life-os:local}"
# The image records the commit it was built from, so this works even if you ran `git pull` yourself first.
built=$(docker image inspect "$image" --format '{{ index .Config.Labels "lifeos.commit" }}' 2>/dev/null || true)
if [ "$built" = "$GIT_COMMIT" ] && [ "${1:-}" != "--rebuild" ]; then
  echo "The running image already has this version ($(git rev-parse --short HEAD)), nothing to build. (./update.sh --rebuild forces one.)"
else
  t=$(date +%s)
  docker compose build web
  echo "Built in $(( $(date +%s) - t ))s."
fi
docker compose --profile mcp up -d --remove-orphans
docker image prune -f >/dev/null
echo "Done in $(( $(date +%s) - start ))s. Running:"; docker compose ps
