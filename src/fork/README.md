# Fork overlay（本分支）

`release_unlock`：**只解除会员限制**，不做其它二次开发。

- `license.ts` → `LicenseManager.can = () => true`
- `main.ts` → `applyFork()`

不要在此分支叠加 TTS 栏 / PDF 朗读等功能；完整 fork 工作流见 `release` 分支。
