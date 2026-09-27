#!/usr/bin/env bash
# ==============================================================================
# Auto Tab Groups - Docker Build & Export Automation (Bash)
# ==============================================================================
set -euo pipefail

echo "====================================================="
echo "  Building Auto Tab Groups via Docker Container...    "
echo "====================================================="

# 1. Hermetic Multi-Stage Build & Direct Local Artifact Export
echo "[1/3] Building extensions and exporting artifacts to .output/..."
docker build --target export --output type=local,dest=. .

echo "Extension successfully built and exported to .output/:"
ls -lh .output/

# 2. Check flags
RUN_TESTS=false
PREVIEW=false
PRUNE=false
CLEAN=false

for arg in "$@"; do
  case $arg in
    --test|-t)
      RUN_TESTS=true
      ;;
    --preview|-p)
      PREVIEW=true
      ;;
    --prune)
      PRUNE=true
      ;;
    --clean)
      CLEAN=true
      ;;
  esac
done

if [ "$RUN_TESTS" = true ]; then
  echo "[2/3] Running automated test suite inside Docker..."
  docker build --target test -t auto-tab-groups:test .
  docker run --rm auto-tab-groups:test bun run test
fi

if [ "$PRUNE" = true ]; then
  echo "[3/3] Pruning dangling images..."
  docker image prune --filter "dangling=true" -f
fi

if [ "$CLEAN" = true ]; then
  echo "Cleaning up project containers, networks, volumes, images, and build cache..."
  docker compose down -v --remove-orphans 2>/dev/null || true
  for target in "auto-tab-groups:builder" "auto-tab-groups:test"; do
    id=$(docker images -q "$target" 2>/dev/null || true)
    if [ -n "$id" ]; then
      docker rmi -f "$id" 2>/dev/null || true
    fi
  done
  docker builder prune -f
  docker image prune -f
  docker volume prune -f
  docker network prune -f
fi

if [ "$PREVIEW" = true ]; then
  echo "Starting preview server on http://localhost:8080..."
  docker compose up -d preview
  echo "Preview server active at http://localhost:8080"
fi

echo "Done!"
