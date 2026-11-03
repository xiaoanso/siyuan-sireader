# CUSTOM Hook Inventory

Keep this table updated when二次开发 hooks change. Agent must re-check after every upgrade.

## Active hooks (additive, preferred)

| Upstream file | Marker / symbol | Purpose |
|---------------|-----------------|---------|
| `src/main.ts` | `applyFork` import + call | Apply license unlock + icons |
| `src/fork/index.ts` | `applyFork()` | Orchestrates overlay |
| `src/fork/license.ts` | `unlockAllFeatures()` | `LicenseManager.can = () => true` |
| `src/fork/icons.ts` | `injectForkIcons()` | TTS chevron icons |
| `src/services/TTSEngine.ts` | `referrerPolicy: 'no-referrer'` + **Sec-MS-GEC v2** (`Sec-MS-GEC-Version=2-…`) | Edge voices/WS; v1 token → HTTP 403 |
| `src/services/TTSPlayer.ts` | `isLoading`, `restartText`, `restart`, speak→restartText | Compatible with Reader/PDF fork controls; keep upstream Offline TTS |
| `src/components/Reader.vue` | `ReaderTtsBar`, `createReaderTtsControls` | TTS toolbar / restart / loading |
| `src/components/EmbedPdfReader.vue` | `pdfSpeakCommand(props)` + `sireader-speak-selection` | PDF selection speak |
| `src/i18n/zh_CN.json` / `en_US.json` | `ttsRestart`, `ttsPreparing`, `ttsPrev`, `ttsNext`, `ttsStyle`, `ttsStyle_*` | Fork copy |

## Fork-owned modules (prefer ours on conflict)

```
src/fork/
  index.ts
  license.ts
  icons.ts
  README.md
  components/ReaderTtsBar.vue
  components/TTSMini.vue          # reference only; not re-exported over upstream
  tts/pdfSpeakCommand.ts
  tts/readerControls.ts
  tts/settings.ts
  tts/TTSEngine.ts                # reference; do not wholesale replace upstream
  tts/TTSPlayer.ts                # reference; do not wholesale replace upstream
```

## Compatibility rules when upstream moves

### OfflineTTS / TTSPlayer

Upstream rewrote OfflineTTS (manifest-based). Fork player that still imports `OFFLINE_TTS_VOICE` / old `synthesizeOfflineTTS(text, speed)` will break.

**Do:** keep upstream `src/services/TTSPlayer.ts` / `OfflineTTS.ts`, only add CUSTOM APIs needed by fork UI.  
**Don't:** `export * from '@/fork/tts/TTSPlayer'`.

### EmbedPDF commands

Upstream registers selection commands in `EmbedPdfReader.vue`. After upgrade, ensure:

1. `pdfSpeakCommand(props)` remains in the command tuple list
2. `sireader:speak-selection` is in `requiredIds`
3. selection menu still inserts `sireader-speak-selection` button

### Reader toolbar

Upstream may restyle toolbar. Re-attach:

1. import `ReaderTtsBar` + `createReaderTtsControls`
2. call controls **after** `embedPdfPages` / `currentView` / `reader` / `clearReadingSelection` exist
3. template shows `<ReaderTtsBar ...>` in `.reader-toolbar-group`

### i18n

Merge keys; never replace whole JSON with old fork file.

## Patch contents expectation

`patches/custom/0001-custom-fork-overlay.patch` should include at least:

- all of `src/fork/**`
- CUSTOM edits listed above
- `CUSTOM_WORKFLOW.md`
- `scripts/rebuild-from-main.sh`
- `scripts/export-custom-patches.sh`

Optional: TTS harness scripts + `vitest.config.ts` if still used.

## Smoke checklist after build

1. Plugin loads; `applyFork()` runs without throw
2. Member-gated features unlocked
3. EPUB: start TTS → bar shows pause/restart/stop
4. PDF: selection menu → 朗读 / speak works
5. Upstream offline TTS model UI still opens (not wiped by fork)
