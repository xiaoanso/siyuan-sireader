/**
 * Feedback loop: Edge TTS after VoiceCraft HTTP refactor
 * GREEN = plain-text and foliate-mark both return audio quickly (no "TTS timeout")
 * Run: node scripts/tts-timeout.harness.mjs
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import { JSDOM } from 'jsdom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const TIMEOUT_MS = 12000

const dom = new JSDOM('<!doctype html><html><body></body></html>')
Object.assign(globalThis, {
  window: Object.assign(dom.window, {
    require: (id) => require(id),
  }),
  document: dom.window.document,
  DOMParser: dom.window.DOMParser,
  XMLSerializer: dom.window.XMLSerializer,
  Blob: globalThis.Blob,
  localStorage: { getItem: () => null, setItem: () => {} },
})
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
try {
  if (!dom.window.crypto?.subtle) Object.defineProperty(dom.window, 'crypto', { value: webcrypto, configurable: true })
} catch {}

async function loadEngine() {
  const candidates = [
    'esbuild',
    path.join(root, 'node_modules/esbuild/lib/main.js'),
    path.join(root, 'node_modules/vite/node_modules/esbuild/lib/main.js'),
    path.join(root, 'node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/lib/main.js'),
    path.join(root, 'node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/lib/main.js'),
  ]
  let esbuild
  for (const id of candidates) {
    try {
      esbuild = id.startsWith('/') || id.includes('node_modules')
        ? await import(pathToFileURL(id).href)
        : await import(id)
      if (esbuild?.build) break
    } catch {}
  }
  const out = path.join(root, 'scripts/.tts-engine-bundle.mjs')
  if (!esbuild?.build) {
    const { execFileSync } = await import('node:child_process')
    const bin = path.join(root, 'node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/bin/esbuild')
    execFileSync(bin, [path.join(root, 'src/services/TTSEngine.ts'), '--bundle', '--format=esm', '--platform=neutral', `--outfile=${out}`], { cwd: root, stdio: 'inherit' })
    return import(pathToFileURL(out).href + `?t=${Date.now()}`)
  }
  await esbuild.build({
    entryPoints: [path.join(root, 'src/services/TTSEngine.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile: out,
  })
  return import(pathToFileURL(out).href + `?t=${Date.now()}`)
}

const { EdgeTTSCore, plainTextFromSSML } = await loadEngine()

const foliate = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en"><s><mark name="0"/>你好世界</s></speak>`
const stripped = plainTextFromSSML(foliate)
if (stripped !== '你好世界') {
  console.log(`FAIL plainTextFromSSML got=${JSON.stringify(stripped)}`)
  process.exit(1)
}
console.log('PASS plainTextFromSSML')

const core = new EdgeTTSCore()
core.setVoice('zh-CN-XiaoxiaoNeural')

const cases = [
  { name: 'plain-text', ssml: '你好世界' },
  { name: 'foliate-mark', ssml: foliate },
]

let failed = 0
for (const c of cases) {
  const t0 = Date.now()
  try {
    const buf = await Promise.race([
      core.toSSMLStream(c.ssml, 1, 0, 0, 'general'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('TTS timeout')), TIMEOUT_MS)),
    ])
    if (!buf?.length) throw new Error('empty audio')
    console.log(`PASS ${c.name} bytes=${buf.length} elapsed=${Date.now() - t0}`)
  } catch (e) {
    failed++
    console.log(`FAIL ${c.name} ${e.message} elapsed=${Date.now() - t0}`)
  }
}
core.close()
console.log(failed ? `RED fail=${failed}` : 'GREEN')
process.exit(failed ? 1 : 0)
