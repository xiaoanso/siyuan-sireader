# Fork overlay（本分支）

`release_unlock`：**只解除会员限制** + Edge TTS 上游兼容。

| 路径 | 作用 |
|------|------|
| `license.ts` | `LicenseManager.can = () => true` |
| `index.ts` / `main.ts` | `applyFork()` |
| `tts/TTSEngine.ts` | Sec-MS-GEC **v2** 实现 |
| `src/services/TTSEngine.ts` | 薄挂钩：`export * from '@/fork/tts/TTSEngine'` |

升级上游时：`TTSEngine.ts` 挂钩优先取 **ours**；其它上游文件先 **theirs**。  
不要在此分支叠加 TTS 栏 / PDF 朗读等功能。
