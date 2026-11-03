/**
 * Feedback loop: "点击朗读没有反应"
 * RED = speak/toggle leaves isActive false (or flashes then resets) within REACTION_MS.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const REACTION_MS = 250

vi.mock('siyuan', () => ({ showMessage: vi.fn() }))

beforeAll(() => {
  class MockAudioContext {
    createBufferSource() {
      return {
        buffer: null,
        connect() {},
        start() { queueMicrotask(() => this._ended?.()) },
        stop() {},
        addEventListener(type: string, fn: () => void) { if (type === 'ended') this._ended = fn },
        context: { suspend() {}, resume() {} },
        _ended: undefined as undefined | (() => void),
      }
    }
    async decodeAudioData() { return {} }
    get destination() { return {} }
  }
  class MockUtterance {
    text = ''
    voice: any = null
    rate = 1
    pitch = 1
    onend: null | (() => void) = null
    onerror: null | (() => void) = null
    constructor(text = '') { this.text = text }
  }
  ;(globalThis as any).AudioContext = MockAudioContext
  ;(globalThis as any).SpeechSynthesisUtterance = MockUtterance
  ;(globalThis as any).speechSynthesis = {
    getVoices: () => [{ name: 'MockLocal', lang: 'zh-CN' }],
    speak(u: any) { setTimeout(() => u.onend?.(), 400) },
    cancel() {},
    pause() {},
    resume() {},
  }
})

const cfg = {
  enabled: true,
  voice: 'MockLocal',
  rate: 1,
  pitch: 0,
  volume: 0,
  style: 'general',
  sentenceGap: 0,
  paragraphGap: 0,
  autoTurnPage: false,
  highlightText: false,
}

async function staysActive(ctrl: any, ms = REACTION_MS) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (!ctrl.isActive.value) return false
    await new Promise(r => setTimeout(r, 20))
  }
  return !!ctrl.isActive.value
}

describe('TTS click reaction', () => {
  let TTSController: any
  let EdgeTTSPlayer: any
  let ctrl: any

  beforeAll(async () => {
    const mod = await import('../src/services/TTSPlayer')
    TTSController = mod.TTSController
    EdgeTTSPlayer = mod.EdgeTTSPlayer
  })

  afterEach(() => {
    ctrl?.destroy?.()
    ctrl = null
  })

  it('A: enabled:false is silent no-op (matches "no reaction")', async () => {
    ctrl = new TTSController()
    await ctrl.speak('你好世界', { ...cfg, enabled: false })
    expect(ctrl.isActive.value).toBe(false)
  })

  it('B: speak(enabled) must stay active long enough to be visible', async () => {
    ctrl = new TTSController()
    const p = ctrl.speak('你好世界。这是第二句。', cfg)
    await new Promise(r => setTimeout(r, 40))
    expect(await staysActive(ctrl)).toBe(true)
    ctrl.destroy()
    await p.catch(() => {})
  })

  it('C: playText once must not instantly reset (toolbar-like path)', async () => {
    ctrl = new TTSController()
    const events: string[] = []
    const p = ctrl.playText('你好世界', { ...cfg, onBlock: (t: string) => events.push(`block:${t}`) }, 'test', false)
    await new Promise(r => setTimeout(r, 40))
    const soon = ctrl.isActive.value
    const text = ctrl.currentText.value
    const stayed = await staysActive(ctrl)
    ctrl.destroy()
    await p.catch((e: any) => events.push(`err:${e?.message || e}`))
    expect({ soon, stayed, text, events }, 'playText reaction diagnostics').toEqual({
      soon: true,
      stayed: true,
      text: expect.any(String),
      events: expect.any(Array),
    })
    expect(soon && stayed).toBe(true)
  })

  it('C2: diagnose why playText dies — capture active timeline', async () => {
    ctrl = new TTSController()
    const timeline: Array<{ t: number; active: boolean; text: string }> = []
    const t0 = Date.now()
    const stamp = () => timeline.push({ t: Date.now() - t0, active: ctrl.isActive.value, text: ctrl.currentText.value })
    stamp()
    const p = ctrl.playText('你好世界', cfg, 'test', false)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 20))
      stamp()
    }
    ctrl.destroy()
    await p.catch(() => {})
    // Soft assert: print timeline always for diagnosis; fail if never stayed active >40ms
    const activeSpans = timeline.filter(s => s.active)
    console.log('[DEBUG-tts] playText timeline', JSON.stringify(timeline))
    expect(activeSpans.length, `timeline=${JSON.stringify(timeline)}`).toBeGreaterThan(2)
  })

  it('D: toggle with fallback document must stay active', async () => {
    ctrl = new TTSController()
    document.body.innerHTML = '<p>这是一本测试书的段落内容，足够长以便分句朗读。</p>'
    const timeline: any[] = []
    const t0 = Date.now()
    const p = ctrl.toggle(() => ({ getView: () => null }), cfg, undefined, 'book')
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 20))
      timeline.push({ t: Date.now() - t0, active: ctrl.isActive.value, text: ctrl.currentText.value })
    }
    console.log('[DEBUG-tts] toggle timeline', JSON.stringify(timeline))
    ctrl.destroy()
    await p.catch(() => {})
    expect(timeline.filter(s => s.active).length, JSON.stringify(timeline)).toBeGreaterThan(2)
  })

  it('E: EdgeTTSPlayer.play on plain <p> must not exit instantly empty', async () => {
    const doc = document.implementation.createHTMLDocument()
    const p = doc.createElement('p')
    p.textContent = '你好世界'
    doc.body.appendChild(p)
    let blocks = 0
    const player = new EdgeTTSPlayer(doc, { ...cfg, onBlock: () => { blocks++ } })
    const t0 = Date.now()
    await Promise.race([
      player.play(),
      new Promise(r => setTimeout(() => r('timeout'), 2000)),
    ])
    const elapsed = Date.now() - t0
    player.stop()
    console.log('[DEBUG-tts] player.play', { elapsed, blocks })
    expect(blocks, `elapsed=${elapsed}`).toBeGreaterThan(0)
  })

  it('G: MarkPanel speak must survive selectionchange (menu click); mouseup still cancels', async () => {
    ;(globalThis as any).speechSynthesis.speak = (u: any) => {
      setTimeout(() => u.onend?.(), 800)
    }
    ctrl = new TTSController()
    const p = ctrl.speak('你好世界，这是一段会被朗读的文字。', cfg)
    await new Promise(r => setTimeout(r, 30))
    expect(ctrl.isActive.value, 'speak should activate').toBe(true)

    // selectionchange path must NOT cancel (menu focus-loss)
    // emulate fixed MarkPanel policy:
    const onCollapse = (type: string) => {
      if (type === 'mouseup' || type === 'touchend') ctrl.cancelLoop()
    }
    onCollapse('selectionchange')
    await new Promise(r => setTimeout(r, 20))
    expect(ctrl.isActive.value, 'selectionchange must not kill speak').toBe(true)

    onCollapse('mouseup')
    await new Promise(r => setTimeout(r, 20))
    expect(ctrl.isActive.value, 'mouseup clear must stop speak').toBe(false)

    ctrl.destroy()
    await p.catch(() => {})
  })
})
