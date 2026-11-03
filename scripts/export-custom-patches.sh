#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
base=${1:-origin/main}
out=patches/custom
mkdir -p "$out"
paths=(
  src/fork
  src/main.ts
  src/services/TTSEngine.ts
  src/services/TTSPlayer.ts
  src/components/Reader.vue
  src/components/EmbedPdfReader.vue
  src/i18n/zh_CN.json
  src/i18n/en_US.json
  CUSTOM_WORKFLOW.md
  scripts/rebuild-from-main.sh
  scripts/export-custom-patches.sh
  scripts/stubs
  scripts/tts-no-reaction.harness.mjs
  scripts/tts-no-reaction.test.ts
  scripts/tts-timeout.harness.mjs
  vitest.config.ts
)
# Stage only overlay paths so new files enter the diff
git add -A -- "${paths[@]}" 2>/dev/null || true
git diff --binary --cached "$base" -- "${paths[@]}" > "$out/0001-custom-fork-overlay.patch"
# keep scripts themselves unstaged if user prefers; patch already captured
echo "Wrote $out/0001-custom-fork-overlay.patch ($(wc -l < "$out/0001-custom-fork-overlay.patch") lines)"
# sanity: must mention fork and CUSTOM
rg -n 'src/fork/index|CUSTOM: fork|applyFork|pdfSpeakCommand|ReaderTtsBar' "$out/0001-custom-fork-overlay.patch" | head -20
