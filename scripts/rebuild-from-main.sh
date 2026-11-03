#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
stamp=$(date +%Y%m%d-%H%M%S)
echo "[1/4] backup release -> backup/release-$stamp"
git branch "backup/release-$stamp" release 2>/dev/null || git branch "backup/release-$stamp" HEAD
echo "[2/4] reset release to origin/main"
git fetch origin
git checkout -B release origin/main
echo "[3/4] apply patches/custom"
shopt -s nullglob
patches=(patches/custom/*.patch)
if ((${#patches[@]} == 0)); then
  echo "No patches found under patches/custom/"
  exit 1
fi
git apply --3way "${patches[@]}"
echo "[4/4] done. Next: pnpm install && pnpm run build"
echo "Conflict tip: keep src/fork/**; for CUSTOM hooks take upstream then re-paste // CUSTOM lines."
