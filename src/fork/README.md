# Fork overlay（二次开发）

本目录集中存放相对上游 `main` 的二次开发。上游路径只保留带 `// CUSTOM:` 标记的极薄挂钩。

> **v2.6.1+ 策略**：上游 OfflineTTS API 已重写，**不要**再把 `TTSEngine.ts` / `TTSPlayer.ts` / `TTSMini.vue` 整文件改成 re-export。  
> 当前以「加法挂钩」接入：保留上游朗读/离线语音，fork 只叠加 license、图标、PDF 朗读、Reader TTS 栏等。  
> `src/fork/tts/TTSEngine.ts`、`TTSPlayer.ts`、`components/TTSMini.vue` 仍保留作后续移植参考。

## 日常升级（推荐）

```bash
# 1) 备份当前 release
git branch backup/release-$(date +%Y%m%d) release

# 2) 以最新上游为基线重建
git fetch origin
git checkout -B release origin/main

# 3) 重放 fork 层与挂钩补丁
git apply --3way patches/custom/*.patch
# 或：checkout 旧 backup 中的 src/fork/**，再按「挂钩列表」手工确认 CUSTOM 标记仍在

# 4) 构建验证后推送
```

冲突处理：

1. `src/fork/**` → 优先 **ours**（你的二次开发）
2. 带 `CUSTOM:` 的上游文件 → 先取 **theirs**，再把 `CUSTOM` 片段贴回
3. i18n JSON → 合并 key（上游全保留 + fork 文案）

## 挂钩列表（v2.6.1 加法版）

| 上游文件 | 挂钩 |
|---------|------|
| `src/main.ts` | `import { applyFork }` + `applyFork()` |
| `src/services/TTSEngine.ts` | `fetch(..., { referrerPolicy: 'no-referrer' })` |
| `src/services/TTSPlayer.ts` | fork 兼容 API：`isLoading` / `restartText` / `restart` |
| `src/components/Reader.vue` | `ReaderTtsBar` + `createReaderTtsControls` |
| `src/components/EmbedPdfReader.vue` | `pdfSpeakCommand(props)` + 选区菜单按钮 |
| `src/i18n/*.json` | fork 文案 key（见下） |
| `src/composables/useSetting.ts` | （可选）扩展 TTS volume/style；默认暂不改 pitch 语义 |

## applyFork() 做什么

- `unlockAllFeatures()`：二次开发解锁会员能力
- `injectForkIcons()`：注入 TTS 栏用到的 chevron 图标

## Fork 文案 key（i18n）

`ttsRestart`、`ttsPreparing`、`ttsPrev`、`ttsNext`、`ttsStyle`、`ttsStyle_*`

## 本地环境

个人思源路径放 `.env`（勿提交）。`.env.example` 保持通用占位即可。
