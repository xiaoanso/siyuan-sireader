/**
 * Feedback loop for: "点击朗读没有反应"
 * Pass = after speak/toggle, isActive stays true for REACTION_MS (user-visible reaction).
 * Fail = silent no-op or instant reset (looks like no reaction).
 *
 * Run: node scripts/tts-no-reaction.harness.mjs
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

const REACTION_MS = 250
const results = []

function assert(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function sleep(ms) {
  await new Promise(r => setTimeout(r, ms))
}

async function stayActive(ctrl, ms = REACTION_MS) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (!ctrl.isActive.value) return false
    await sleep(20)
  }
  return ctrl.isActive.value
}

// Minimal DOM + audio mocks for Node
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.DOMParser = dom.window.DOMParser
globalThis.Range = dom.window.Range
globalThis.Node = dom.window.Node
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Element = dom.window.Element
globalThis.AudioContext = class {
  createBufferSource() {
    return {
      buffer: null,
      connect() {},
      start() { queueMicrotask(() => this._ended?.()) },
      stop() {},
      addEventListener(type, fn) { if (type === 'ended') this._ended = fn },
      context: { suspend() {}, resume() {} },
    }
  }
  async decodeAudioData() { return {} }
  get destination() { return {} }
}
globalThis.speechSynthesis = {
  getVoices: () => [{ name: 'MockLocal', lang: 'zh-CN' }],
  speak(u) { queueMicrotask(() => u.onend?.()) },
  cancel() {},
  pause() {},
  resume() {},
}

// Stub siyuan showMessage
const Module = require('module')
const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'siyuan') return { showMessage: () => {} }
  return origLoad(request, parent, isMain)
}

// Dynamic import compiled path via vite-node or tsx — use dist if available, else build with esbuild
async function loadTTS() {
  try {
    // Prefer transforming TS in-process with esbuild-register style via vite's dependency
    const esbuild = await import('esbuild')
    const entry = path.join(root, 'src/services/TTSPlayer.ts')
    const outfile = path.join(root, 'scripts/.tts-harness-bundle.mjs')
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      outfile,
      external: ['siyuan'],
      alias: {
        'foliate-js/tts.js': path.join(root, 'node_modules/foliate-js/tts.js'),
        'foliate-js/text-walker.js': path.join(root, 'node_modules/foliate-js/text-walker.js'),
      },
      define: { 'process.env.NODE_ENV': '"test"' },
    })
    // Patch siyuan for the bundle via import map — rewrite file to inject stub
    const fs = await import('node:fs')
    let code = fs.readFileSync(outfile, 'utf8')
    code = code.replace(/from\s*["']siyuan["']/g, 'from "data:text/javascript,export const showMessage=()=>{}"')
    fs.writeFileSync(outfile, code)
    return import(pathToFileURL(outfile).href + `?t=${Date.now()}`)
  } catch (e) {
    console.error('bundle failed', e)
    throw e
  }
}

const { TTSController, EdgeTTSPlayer } = await loadTTS()

const cfg = {
  enabled: true,
  voice: 'MockLocal',
  rate: 1,
  pitch: 1,
  sentenceGap: 0,
  paragraphGap: 0,
  autoTurnPage: false,
  highlightText: false,
}

// --- Case A: speak with enabled:false → exact "no reaction" ---
{
  const ctrl = new TTSController()
  await ctrl.speak('你好世界', { ...cfg, enabled: false })
  assert('A.enabled-false is silent no-op', !ctrl.isActive.value, `isActive=${ctrl.isActive.value}`)
}

// --- Case B: speak with enabled:true should stay active (loop) ---
{
  const ctrl = new TTSController()
  const p = ctrl.speak('你好世界。这是第二句。', cfg)
  await sleep(50)
  const stayed = await stayActive(ctrl, REACTION_MS)
  assert('B.speak-enabled stays active (reaction)', stayed, `isActive=${ctrl.isActive.value} text=${ctrl.currentText.value}`)
  ctrl.destroy()
  await p.catch(() => {})
}

// --- Case C: playText once — if SSML empty, instant reset = no reaction ---
{
  const ctrl = new TTSController()
  const p = ctrl.playText('你好世界', cfg, 'test', false)
  await sleep(30)
  const activeSoon = ctrl.isActive.value
  await sleep(REACTION_MS)
  const still = ctrl.isActive.value
  assert('C.playText-once visible reaction window', activeSoon && still, `soon=${activeSoon} still=${still} text=${JSON.stringify(ctrl.currentText.value)}`)
  ctrl.destroy()
  await p.catch(() => {})
}

// --- Case D: toggle with synthetic reader doc ---
{
  const ctrl = new TTSController()
  const book = document.implementation.createHTMLDocument()
  book.body.innerHTML = '<p>这是一本测试书的段落内容，足够长以便分句。</p>'
  const fakeReader = {
    getView: () => null,
  }
  // Patch getDocument path: when no view, falls back to global document — inject book into body
  document.body.innerHTML = book.body.innerHTML
  const p = ctrl.toggle(() => fakeReader, cfg, undefined, 'book')
  await sleep(50)
  const stayed = await stayActive(ctrl, REACTION_MS)
  assert('D.toggle-fallback-doc stays active', stayed, `isActive=${ctrl.isActive.value} text=${JSON.stringify(ctrl.currentText.value)}`)
  ctrl.destroy()
  await p.catch(() => {})
}

// --- Case E: EdgeTTSPlayer firstSSML emptiness on plain text doc ---
{
  const doc = document.implementation.createHTMLDocument()
  const p = doc.createElement('p')
  p.textContent = '你好世界'
  doc.body.appendChild(p)
  const player = new EdgeTTSPlayer(doc, { ...cfg, onBlock: () => {} })
  const started = Date.now()
  await Promise.race([player.play(), sleep(2000).then(() => 'timeout')])
  const elapsed = Date.now() - started
  // If play returns in <20ms with no audio work, likely empty SSML / instant exit
  assert('E.player.play does real work (not instant empty exit)', elapsed >= 15, `elapsed=${elapsed}ms`)
  player.stop()
}

const failed = results.filter(r => !r.ok)
console.log('\n---')
console.log(`total=${results.length} fail=${failed.length}`)
if (failed.length) {
  console.log('RED — symptom loop caught failures:')
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`))
  process.exit(1)
}
console.log('GREEN — all reaction checks passed')
process.exit(0)
