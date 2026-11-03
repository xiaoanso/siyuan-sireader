---
name: sireader-fork-upgrade
description: >-
  Rebuild siyuan-sireader secondary-development release on latest upstream main
  while preserving fork features (license unlock, TTS bar, PDF speak, CUSTOM
  hooks). Use when merging/updating origin/main into release, rebasing custom
  fork overlay, resolving both-added merge conflicts, exporting patches/custom,
  or when the user says 合并上游、升级 main、同步最新版、二次开发合并.
---

# SiReader Fork Upgrade

Goal: keep二次开发功能完整，同时吃到上游最新功能。  
**禁止**再对 `release` 整仓 `git merge origin/main`（会再次 both-added 爆炸）。  
正确做法：**以 `origin/main` 为干净基线 + 重放 `src/fork` + `CUSTOM` 挂钩补丁**。

## When to use

- 用户要合并/同步最新 `main` / 上游版本到二次开发
- `release` merge 冲突很多（尤其 `both added`）
- 需要导出/更新 `patches/custom`，或验证 fork 功能是否还在

## Non-negotiables

1. `main` 只跟踪上游，不塞二次开发
2. 二次开发优先落在 `src/fork/**`
3. 改上游文件必须极薄，并标 `// CUSTOM:` / `<!-- CUSTOM:`
4. **不要**把 `TTSEngine.ts` / `TTSPlayer.ts` / `TTSMini.vue` 整文件 re-export 盖掉上游（OfflineTTS 会断）
5. 升级前必须 `backup/release-*`
6. 升级后必须 `pnpm install && pnpm run build`；装依赖失败先看下方「已知坑」

## Workflow (agent checklist)

Copy and track:

```
Upgrade Progress:
- [ ] 1. Inspect current branch / dirty tree / in-progress merge
- [ ] 2. Backup release tip
- [ ] 3. Abort bad merge if any
- [ ] 4. Fetch origin; rebuild release from origin/main
- [ ] 5. Apply patches/custom (or restore fork + reapply CUSTOM)
- [ ] 6. Verify CUSTOM hooks + fork feature checklist
- [ ] 7. Fix install/build issues
- [ ] 8. Export fresh patch
- [ ] 9. Summarize what landed / what needs manual port
```

### 1) Inspect

```bash
git status -sb
git branch -vv
test -f .git/MERGE_HEAD && echo 'MERGE IN PROGRESS'
rg -n 'CUSTOM:' src/main.ts src/services/TTSEngine.ts src/services/TTSPlayer.ts \
  src/components/Reader.vue src/components/EmbedPdfReader.vue || true
```

If mid-merge with many conflicts: **prefer abort**, then rebuild（不要硬合完再升级）。

### 2) Backup

```bash
git branch backup/release-$(date +%Y%m%d-%H%M%S) release
# also keep named backup of last known-good custom tip if rewriting
```

### 3) Abort bad merge (if needed)

```bash
git merge --abort
```

### 4–5) Rebuild + apply overlay

Prefer script:

```bash
./scripts/rebuild-from-main.sh
```

Manual equivalent:

```bash
git fetch origin
git checkout -B release origin/main
git apply --3way patches/custom/*.patch
```

Conflict rules:

| Path | Strategy |
|------|----------|
| `src/fork/**` | keep **ours** (二次开发) |
| files with `CUSTOM:` | take **theirs** first, re-paste CUSTOM snippets |
| `src/i18n/*.json` | keep all upstream keys + add fork keys |
| unrelated upstream new files | take upstream |

If patch fails hard:  
`git checkout backup/release-... -- src/fork/` then manually re-apply hooks from [HOOKS.md](HOOKS.md).

### 6) Verify fork features still present

Must all be true after upgrade:

- [ ] `src/fork/index.ts` exports `applyFork`
- [ ] `src/main.ts` imports and calls `applyFork()`
- [ ] `License` unlock via `src/fork/license.ts`
- [ ] Reader TTS bar: `ReaderTtsBar` + `createReaderTtsControls`
- [ ] PDF selection speak: `pdfSpeakCommand` + menu button `sireader-speak-selection`
- [ ] TTSController has `isLoading` / `restartText` / `restart`
- [ ] TTSEngine voices fetch has `referrerPolicy: 'no-referrer'`
- [ ] i18n has `ttsRestart` / `ttsPreparing` / `ttsStyle_*`

Also scan upstream changelog/diff for APIs your fork calls (`OfflineTTS`, `TTSController.sync`, EmbedPDF command registration). If upstream renamed/broke an API, **adapt fork** — do not wipe upstream implementation.

### 7) Install + build

```bash
pnpm install && pnpm run build
```

Known pits (fix before inventing new deps):

- `foliate-js` short SHA cannot resolve → use **full commit SHA** in `package.json`
- `pnpm-workspace.yaml` `allowBuilds` must set `esbuild: true` and `'@parcel/watcher': true`
- personal SiYuan path belongs in `.env`, not committed `.env.example`

### 8) Re-export patch after any hook change

```bash
./scripts/export-custom-patches.sh origin/main
```

### 9) Report to user

Short summary only:

- upstream base commit / version
- backup branch name
- features preserved
- any upstream feature that forced fork adaptation
- whether commit/push is still needed（**do not commit/push unless asked**；推 `origin/release` 若历史重写需用户确认 `--force-with-lease`）

## Adding new二次开发 later

1. Put logic in `src/fork/**` when possible
2. If upstream file must change: minimal diff + `CUSTOM` marker
3. Update [HOOKS.md](HOOKS.md) hook table
4. Run `./scripts/export-custom-patches.sh origin/main`

## References

- Hook inventory: [HOOKS.md](HOOKS.md)
- Human doc: `CUSTOM_WORKFLOW.md`
- Fork notes: `src/fork/README.md`
- Scripts: `scripts/rebuild-from-main.sh`, `scripts/export-custom-patches.sh`
