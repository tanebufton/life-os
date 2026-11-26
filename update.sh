#!/usr/bin/env bash
# One command to update a Docker install: ./update.sh
# Pulls the latest code, gets the image for it (web, worker and mcp share it), restarts what changed, and clears old images.
# With LIFEOS_REGISTRY_IMAGE set (in .env, e.g. ghcr.io/you/life-os), the image is downloaded: GitHub builds it on every push to main
# (.github/workflows/image.yml), so nothing is built here. Without it, or if the download isn't available, the image is built here.
#   ./update.sh --build    build here even when a downloaded image is configured
#   ./update.sh --rebuild  get the image again even if this version is already running
#   ./update.sh --deep     also remove unused images over a week old
set -euo pipefail
cd "$(dirname "$0")"
start=$(date +%s)
arg="${1:-}"
# Settings come from the environment, or else from .env (the same file docker compose reads).
envfile() { [ -f .env ] && sed -n "s/^[[:space:]]*$1=[\"']\{0,1\}\([^\"'#[:space:]]*\).*/\1/p" .env | tail -1; true; }
git pull --ff-only
export DOCKER_BUILDKIT=1 GIT_COMMIT=$(git rev-parse HEAD)
image="${LIFEOS_IMAGE:-$(envfile LIFEOS_IMAGE)}"; image="${image:-life-os:local}"
registry="${LIFEOS_REGISTRY_IMAGE:-$(envfile LIFEOS_REGISTRY_IMAGE)}"
wait_max="${LIFEOS_PULL_WAIT:-900}" # seconds to wait for GitHub to finish building this commit
short=$(git rev-parse --short HEAD)

build_here() {
  t=$(date +%s)
  docker compose build web
  echo "Built in $(( $(date +%s) - t ))s."
}

# Downloads <registry>:sha-<commit>, waiting while GitHub is still building it. Returns 1 if it can't, so the caller builds here instead.
pull_image() {
  local want="$registry:sha-$GIT_COMMIT" t out waited=0
  t=$(date +%s)
  echo "Downloading the image for $short from $registry ..."
  while :; do
    if out=$(docker pull -q "$want" 2>&1); then break; fi
    if echo "$out" | grep -qiE 'denied|unauthorized|authentication required'; then
      echo "The registry refused the download. Sign in once with: docker login ghcr.io -u <github user>  (password: a token with read:packages)."
      return 1
    fi
    if ! echo "$out" | grep -qiE 'not found|manifest unknown|does not exist'; then
      echo "Couldn't download the image: $out"; return 1
    fi
    if [ "$waited" -ge "$wait_max" ]; then
      echo "GitHub hasn't published an image for $short after $(( wait_max / 60 )) minutes (see the Actions tab)."; return 1
    fi
    [ "$waited" = 0 ] && echo "GitHub is still building this version. Waiting for it (checking every 15s, up to $(( wait_max / 60 )) minutes) ..."
    sleep 15; waited=$(( waited + 15 ))
  done
  # Keep only the usual name, so the previous image becomes untagged and is cleared below.
  docker tag "$want" "$image" && docker rmi "$want" >/dev/null
  echo "Downloaded in $(( $(date +%s) - t ))s."
}

# The image records the commit it was built from, so this works even if you ran `git pull` yourself first.
built=$(docker image inspect "$image" --format '{{ index .Config.Labels "lifeos.commit" }}' 2>/dev/null || true)
if [ "$built" = "$GIT_COMMIT" ] && [ "$arg" != "--rebuild" ]; then
  echo "The running image already has this version ($short), nothing to get. (./update.sh --rebuild forces it.)"
elif [ -n "$registry" ] && [ "$arg" != "--build" ]; then
  pull_image || { echo "Building here instead."; build_here; }
else
  build_here
fi
docker compose --profile mcp up -d --remove-orphans
# Tidy up, only now that the new version is in place and running (the script stops at the first failure above, so a bad update never prunes anything).
# 1. the previous LifeOS image, now untagged.  2. old build cache beyond ~3 GB (the newest cache stays, so a build here is still quick).
freed=$( { docker image prune -f; docker builder prune -f --keep-storage 3GB; } 2>/dev/null | sed -n 's/^Total\( reclaimed space\)\{0,1\}:[[:space:]]*//p' | paste -sd'+' - || true)
[ -n "${freed:-}" ] && echo "Cleaned up old images and build cache (freed: ${freed//+/ + })."
# --deep also removes every image nothing is using that is over a week old (old cloudflared versions and so on). Running containers are never touched.
[ "$arg" = "--deep" ] && docker image prune -a -f --filter "until=168h" | tail -1
echo "Done in $(( $(date +%s) - start ))s. Running:"; docker compose ps
