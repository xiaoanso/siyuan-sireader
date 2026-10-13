# Fork overlay（二次开发）

本目录集中存放相对上游 `main` 的二次开发。上游路径只保留极薄挂钩（re-export / 单行 import / `applyFork()`）。

## 合并约定

1. `git fetch upstream && git merge upstream/main`（或合并 `origin/main`）
2. 冲突文件若在「挂钩列表」内：优先取 **theirs**，再确认挂钩仍在
3. `src/fork/**` 冲突：优先取 **ours**

## 挂钩列表

| 上游文件 | 挂钩 |
|---------|------|
| `src/services/TTSEngine.ts` | `export * from '@/fork/tts/TTSEngine'` |
| `src/services/TTSPlayer.ts` | `export * from '@/fork/tts/TTSPlayer'` |
| `src/components/TTSMini.vue` | re-export fork 组件 |
| `src/main.ts` | `applyFork()` |
| `src/composables/useSetting.ts` | 从 fork 引入 TTS settings / normalize |
| `src/components/Reader.vue` | `ReaderTtsBar` + `createReaderTtsControls` |
| `src/components/EmbedPdfReader.vue` | `pdfSpeakCommands(...)` |
| `src/utils/icon.ts` | chevrons 由 `applyFork` 注入 |
| `src/i18n/*.json` | fork 文案 key（手合） |

## Fork 文案 key（i18n）

`ttsVolume`、`ttsStyle_*`、`ttsRestart`、`ttsPreparing`、`ttsResume`、`ttsNoText` 等朗读增强相关 key。
