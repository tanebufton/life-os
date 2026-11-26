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
# Tidy up, only now that the new version is built and running (the script stops at the first failure above, so a bad update never prunes anything).
# 1. the previous LifeOS image, now untagged.  2. old build cache beyond ~3 GB (the newest cache stays, so the next update is still quick).
freed=$( { docker image prune -f; docker builder prune -f --keep-storage 3GB; } 2>/dev/null | sed -n 's/^Total\( reclaimed space\)\{0,1\}:[[:space:]]*//p' | paste -sd'+' - || true)
[ -n "${freed:-}" ] && echo "Cleaned up old images and build cache (freed: ${freed//+/ + })."
# ./update.sh --deep also removes every image nothing is using that is over a week old (old cloudflared versions and so on). Running containers are never touched.
[ "${1:-}" = "--deep" ] && docker image prune -a -f --filter "until=168h" | tail -1
echo "Done in $(( $(date +%s) - start ))s. Running:"; docker compose ps
