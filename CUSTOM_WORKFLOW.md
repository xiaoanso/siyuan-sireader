# 二次开发升级工作流

目标：保存自己的二次开发，同时能低冲突地跟上上游 `main`。

Agent 入口：让 Cursor 加载 skill **`sireader-fork-upgrade`**  
（路径：`.cursor/skills/sireader-fork-upgrade/SKILL.md`）。  
可以说：「用 sireader-fork-upgrade 合并最新 main」。

## 分支约定

| 分支 | 用途 |
|------|------|
| `main` | 只跟踪 `origin/main` |
| `release` | 对外二次开发版本 = 上游 + `src/fork` + `CUSTOM` 挂钩 |
| `backup/release-*` | 升级前备份 |

## 已落地的二次开发（v2.6.1 基线）

- `src/fork/**`：license 解锁、图标、PDF 朗读命令、Reader TTS 栏、旧 TTS 实现参考
- 上游薄挂钩（搜 `CUSTOM:`）：
  - `src/main.ts` → `applyFork()`
  - `src/services/TTSEngine.ts` → `referrerPolicy`
  - `src/services/TTSPlayer.ts` → `isLoading` / `restartText` / `restart`
  - `src/components/Reader.vue` → `ReaderTtsBar`
  - `src/components/EmbedPdfReader.vue` → `pdfSpeakCommand`
  - `src/i18n/*.json` → fork 文案 key

## 升级步骤

```bash
./scripts/rebuild-from-main.sh
```

或手工：

```bash
git branch backup/release-$(date +%Y%m%d) release
git fetch origin
git checkout -B release origin/main
git apply --3way patches/custom/*.patch
# 解决冲突：fork/** 用 ours；带 CUSTOM 的文件先 theirs 再贴回 CUSTOM
pnpm install && pnpm run build
```

## 以后加功能的规矩

1. 优先写到 `src/fork/**` 新文件
2. 必须改上游文件时，只加几行并标 `// CUSTOM: ...`
3. 改完后重新导出补丁：`./scripts/export-custom-patches.sh`
