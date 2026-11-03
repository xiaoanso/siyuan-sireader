import { ref } from 'vue'
import { showMessage } from 'siyuan'
import { TTS } from 'foliate-js/tts.js'
import { textWalker } from 'foliate-js/text-walker.js'
import { EdgeTTSCore, loadLocalVoices, toArrayBuffer } from './TTSEngine'
import { ttsNodeFilter } from '@/services/TTSExtractor'
import { OFFLINE_TTS_VOICE, synthesizeOfflineTTS } from '@/services/OfflineTTS'

declare const window: any
const BLOCK_SELECTOR = 'article,aside,blockquote,div,dl,dt,dd,figure,footer,form,h1,h2,h3,h4,h5,h6,header,li,main,ol,p,pre,section,tr'

export class EdgeTTSPlayer {
  private edge = new EdgeTTSCore()
  private foliateTTS: any
  private view: any
  private doc?: Document
  private renderer: any
  private startRange?: Range
  private config: any
  private audioCtx = new AudioContext()
  private stopped = false
  private paused = false
  private isLocal = false
  private currentSource: any = null
  private voiceTask: Promise<void>
  private ticket = 0
  private lastSpokenText = ''

  constructor(source: Document | any, config: any, startRange?: Range) {
    this.view = source?.initTTS ? source : null
    this.doc = this.view ? undefined : source
    this.renderer = this.view?.renderer
    this.config = config
    this.startRange = startRange
    this.edge.setVoice(config.voice)
    this.voiceTask = this.checkLocalVoice(config.voice)
  }

  private async checkLocalVoice(voiceName: string) {
    if (!voiceName || voiceName === OFFLINE_TTS_VOICE.name) {
      this.isLocal = false
      return
    }
    const locals = await loadLocalVoices()
    this.isLocal = locals.some(v => v.name === voiceName)
  }

  async updateConfig(config: any) {
    const voiceChanged = config.voice && config.voice !== this.config.voice
    this.config = { ...this.config, ...config }
    if (!voiceChanged) return
    this.edge.setVoice(config.voice)
    await this.checkLocalVoice(config.voice)
    this.stopCurrent()
  }

  private highlighter = (range: Range) => {
    this.config.highlightText && this.renderer?.scrollToAnchor?.(range, true)
  }

  private stopCurrent() {
    try { this.isLocal ? window.speechSynthesis.cancel() : this.currentSource?.stop?.() } catch {}
    this.currentSource = null
  }

  private async initPipeline() {
    if (this.view) {
      await this.view.initTTS('sentence', ttsNodeFilter, this.highlighter)
      this.foliateTTS = this.view.tts
      this.renderer = this.view.renderer
    } else if (this.doc) {
      this.foliateTTS ||= new TTS(this.doc, textWalker, ttsNodeFilter, this.highlighter, 'sentence')
    }
  }

  private textOf(ssml: string) {
    try { return new DOMParser().parseFromString(ssml, 'application/xml').documentElement?.textContent?.trim() || '' }
    catch { return ssml.replace(/<[^>]+>/g, ' ').trim() }
  }

  private ssmlOf(range?: Range, fallback = '') {
    if (!range) return fallback
    const doc = document.implementation.createHTMLDocument()
    doc.body.appendChild(range.cloneContents())
    return new TTS(doc, textWalker, ttsNodeFilter, () => {}, 'sentence').start() || fallback
  }

  private markSSML(ssml = '') {
    const mark = /<mark\b[^>]*\bname="([^"]+)"/.exec(ssml)?.[1]
    mark && this.foliateTTS?.setMark(mark)
    // Foliate #speak(from mark) returns mark→end-of-block; only speak the current sentence range.
    return this.ssmlOf(this.foliateTTS?.getLastRange?.(), ssml)
  }

  private firstSSML(fromCurrent: boolean) {
    if (fromCurrent) return this.ssmlOf(this.foliateTTS?.getLastRange?.(), this.foliateTTS?.resume())
    const range = this.startRange
    this.startRange = undefined
    // Prefer from(range); otherwise start() at first block — do NOT call nextMark() here
    // (nextMark with lastMark=null advances to the *next* block and skips the first).
    return this.markSSML(range ? this.foliateTTS?.from(range) : this.foliateTTS?.start())
  }

  private async nextSSML(paused = false) {
    const raw = this.foliateTTS?.nextMark(paused || this.config.highlightText)
    if (raw) return this.markSSML(raw)
    if (!this.view || !this.config.autoTurnPage) return ''
    const doc = this.foliateTTS?.doc
    await this.view.next()
    await this.view.initTTS('sentence', ttsNodeFilter, this.highlighter)
    this.foliateTTS = this.view.tts
    if (this.foliateTTS?.doc === doc) return ''
    // After page turn, start at first sentence of the new document (not nextMark).
    return this.markSSML(this.foliateTTS?.start())
  }

  private waitWhilePaused(ticket: number) {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (this.stopped || ticket !== this.ticket || !this.paused) return resolve()
        setTimeout(check, 50)
      }
      check()
    })
  }

  private async playSSML(ssml: string, ticket: number) {
    while (this.paused && !this.stopped && ticket === this.ticket) await this.waitWhilePaused(ticket)
    if (this.stopped || ticket !== this.ticket || !ssml) return
    const text = this.textOf(ssml)
    if (!text) return
    // Guard against accidental duplicate utterance of the exact same sentence.
    if (text === this.lastSpokenText) return
    this.lastSpokenText = text
    this.config.onBlock?.(text)
    const range = this.foliateTTS?.getLastRange?.()
    this.config.highlightText && range && this.renderer?.scrollToAnchor?.(range, true)
    if (this.config.voice === OFFLINE_TTS_VOICE.name) return this.playOfflineText(text, ticket)
    return this.isLocal ? this.playLocal(text, ticket) : this.playOnline(text, ticket)
  }

  private notifySpeakStart() {
    this.config.onSpeakStart?.()
  }

  private playLocal(text: string, ticket: number) {
    return new Promise<void>((resolve) => {
      if (this.stopped || ticket !== this.ticket) return resolve()
      const utterance = new SpeechSynthesisUtterance(text)
      const voice = window.speechSynthesis.getVoices().find((v: any) => v.name === this.config.voice)
      if (voice) utterance.voice = voice
      utterance.rate = this.config.rate || 1
      const pitchHz = Number(this.config.pitch) || 0
      utterance.pitch = Math.max(0.5, Math.min(2, 1 + pitchHz / 100))
      this.currentSource = utterance
      utterance.onend = utterance.onerror = () => (this.currentSource = null, resolve())
      this.notifySpeakStart()
      window.speechSynthesis.speak(utterance)
    })
  }

  private async playOnline(text: string, ticket: number) {
    if (!text) return
    const buf = await this.edge.toSSMLStream(
      text,
      this.config.rate || 1,
      Number(this.config.pitch) || 0,
      Number(this.config.volume) || 0,
      this.config.style || 'general',
    )
    if (this.stopped || ticket !== this.ticket) return
    while (this.paused && !this.stopped && ticket === this.ticket) await this.waitWhilePaused(ticket)
    if (this.stopped || ticket !== this.ticket) return
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await this.audioCtx.decodeAudioData(toArrayBuffer(buf))
    }
    catch {
      throw new Error('音频解码失败')
    }
    this.stopCurrent()
    const source = this.audioCtx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.audioCtx.destination)
    return new Promise<void>((resolve) => {
      if (this.stopped || ticket !== this.ticket) return resolve()
      this.currentSource = source
      source.addEventListener('ended', () => (this.currentSource = null, resolve()), { once: true })
      try {
        this.notifySpeakStart()
        source.start(0)
      } catch { this.currentSource = null; resolve() }
    })
  }

  private async playOfflineText(text: string, ticket: number) {
    if (!text) return
    const audio = await synthesizeOfflineTTS(text, this.config.rate || 1)
    if (this.stopped || ticket !== this.ticket) return
    while (this.paused && !this.stopped && ticket === this.ticket) await this.waitWhilePaused(ticket)
    if (this.stopped || ticket !== this.ticket) return
    if (this.audioCtx.state !== 'running') await this.audioCtx.resume()
    const buffer = this.audioCtx.createBuffer(1, audio.samples.length, audio.sampleRate)
    buffer.copyToChannel(audio.samples, 0)
    this.stopCurrent()
    const source = this.audioCtx.createBufferSource()
    source.buffer = buffer
    source.connect(this.audioCtx.destination)
    return new Promise<void>((resolve) => {
      if (this.stopped || ticket !== this.ticket) return resolve()
      this.currentSource = source
      source.addEventListener('ended', () => (this.currentSource = null, resolve()), { once: true })
      try {
        this.notifySpeakStart()
        source.start(0)
      } catch { this.currentSource = null; resolve() }
    })
  }

  private async playFrom(ssml: string, ticket: number) {
    if (!ssml) {
      this.config.onSpeakStart?.()
      return
    }
    while (!this.stopped && ticket === this.ticket && ssml) {
      await this.playSSML(ssml, ticket)
      if (this.stopped || ticket !== this.ticket) break
      while (this.paused && !this.stopped && ticket === this.ticket) await this.waitWhilePaused(ticket)
      if (this.stopped || ticket !== this.ticket) break
      const prev = this.foliateTTS?.getLastRange?.()
      this.lastSpokenText = '' // allow identical wording on a later sentence
      ssml = await this.nextSSML()
      if (!ssml) break
      const gap = this.gapOf(prev, this.foliateTTS?.getLastRange?.())
      if (gap > 0) {
        await this.delay(gap)
        while (this.paused && !this.stopped && ticket === this.ticket) await this.waitWhilePaused(ticket)
        if (this.stopped || ticket !== this.ticket) break
      }
    }
  }

  private blockOf(range?: Range) {
    const node = range?.startContainer
    const el = node?.nodeType === Node.ELEMENT_NODE ? node as Element : node?.parentElement
    return el?.closest?.(BLOCK_SELECTOR)
  }

  private gapOf(prev?: Range, next?: Range) {
    return 1000 * (this.blockOf(prev) && this.blockOf(prev) !== this.blockOf(next)
      ? this.config.paragraphGap ?? 0.3
      : this.config.sentenceGap ?? 0)
  }

  private delay(ms: number) {
    return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()
  }

  async play(fromCurrent = false) {
    await this.initPipeline()
    await this.voiceTask
    this.stopped = this.paused = false
    this.lastSpokenText = ''
    await this.playFrom(this.firstSSML(fromCurrent), ++this.ticket)
  }

  jump(delta: number) {
    if (!this.foliateTTS) {
      this.config.onSpeakStart?.()
      return
    }
    const ticket = ++this.ticket
    const seek = delta < 0 ? this.markSSML(this.foliateTTS.prevMark(true)) : this.nextSSML(true)
    this.stopped = this.paused = false
    this.lastSpokenText = ''
    this.stopCurrent()
    Promise.resolve(seek).then(ssml => this.playFrom(ssml, ticket))
  }

  pause() { this.paused = true; this.isLocal ? window.speechSynthesis.pause() : this.currentSource?.context?.suspend() }
  resume() {
    if (!this.paused) return
    this.paused = false
    this.isLocal ? window.speechSynthesis.resume() : this.currentSource?.context?.resume()
  }

  stop() {
    this.stopped = true
    this.paused = false
    this.ticket++
    this.lastSpokenText = ''
    this.stopCurrent()
    this.edge.close()
  }
}

export class TTSController {
  private player: EdgeTTSPlayer | null = null
  private loopText: string | null = null
  public isActive = ref(false)
  public isLoading = ref(false)
  public paused = ref(false)
  public title = ref('')
  public currentText = ref('')

  async speak(text: string, config: any, title = '选中文本') {
    return this.playText(text, config, title, true)
  }

  async playText(text: string, config: any, title = '朗读中', loop = false) {
    if (!config?.enabled || !text?.trim()) return
    if (this.isActive.value) return this.togglePause()
    return this.restartText(text, config, title, loop)
  }

  /** Always stop and restart plain-text / loop playback (ignores pause toggle). */
  async restartText(text: string, config: any, title = '朗读中', loop = false) {
    if (!config?.enabled || !text?.trim()) return
    this.beginPlayback(title)
    const trimmed = text.trim()
    this.loopText = loop ? trimmed : null
    try {
      if (loop) await this.playLoop(config)
      else await this.playDocument(trimmed, config)
    }
    catch (error) { showMessage((error instanceof Error ? error.message : String(error)) || 'TTS 播放失败', 3000, 'error') }
    finally { if (!this.loopText && !this.paused.value) this.reset() }
  }

  private playerConfig(config: any) {
    return {
      ...config,
      onBlock: (text: string) => this.currentText.value = text,
      onSpeakStart: () => { this.isLoading.value = false },
    }
  }

  private beginPlayback(title: string) {
    this.stop()
    this.paused.value = false
    this.isLoading.value = true
    this.isActive.value = true
    this.title.value = title
  }

  private async playDocument(text: string, config: any) {
    const doc = document.implementation.createHTMLDocument(), p = doc.createElement('p')
    p.textContent = text
    doc.body.appendChild(p)
    this.player = new EdgeTTSPlayer(doc, this.playerConfig(config))
    await this.player.play()
  }

  private waitWhileControllerPaused() {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!this.loopText || !this.paused.value) return resolve()
        setTimeout(check, 50)
      }
      check()
    })
  }

  private async playLoop(config: any) {
    while (this.loopText) {
      while (this.loopText && this.paused.value) await this.waitWhileControllerPaused()
      if (!this.loopText) break
      const doc = document.implementation.createHTMLDocument(), p = doc.createElement('p')
      p.textContent = this.loopText
      doc.body.appendChild(p)
      this.player = new EdgeTTSPlayer(doc, this.playerConfig(config))
      await this.player.play()
      if (!this.loopText) break
    }
  }

  async toggle(getReader: () => any, config: any, selection?: { text: string; range?: Range }, title = '朗读中') {
    if (!config?.enabled) return
    if (this.isActive.value) return this.togglePause()
    return this.restart(getReader, config, selection, title)
  }

  /** Always stop and restart from selection or current visible page (ignores pause toggle). */
  async restart(getReader: () => any, config: any, selection?: { text: string; range?: Range }, title = '朗读中') {
    if (!config?.enabled) return
    this.beginPlayback(title)
    try {
      const { view, doc, renderer, location } = this.getDocument(getReader)
      if (!view && !doc?.body) throw new Error('无法获取文档内容')
      const startRange = selection?.range || (renderer && doc && this.getVisibleRange(renderer, doc, location))
      this.player = new EdgeTTSPlayer(view || doc, this.playerConfig(config), startRange)
      await this.player.play()
      if (!this.paused.value) this.reset()
    } catch (error) { this.reset(); showMessage((error instanceof Error ? error.message : String(error)) || 'TTS 播放失败', 3000, 'error') }
  }

  cancelLoop() { this.loopText && this.destroy() }
  updateConfig(config: any) { this.player?.updateConfig(config) }
  jump(delta: number) {
    if (!this.isActive.value) return
    this.paused.value = false
    this.isLoading.value = true
    this.player?.jump(delta)
  }
  togglePause() {
    if (!this.isActive.value || this.isLoading.value) return
    this.paused.value = !this.paused.value
    this.paused.value ? this.player?.pause() : this.player?.resume()
  }
  stop() {
    this.loopText = null
    this.player?.stop()
    this.player = null
    this.currentText.value = ''
    this.isLoading.value = false
  }
  destroy() { this.stop(); this.reset() }
  sync(tts: { enabled?: boolean } | boolean | null | undefined) {
    if (tts === false || tts == null) return this.destroy()
    if (typeof tts === 'boolean') return tts ? undefined : this.destroy()
    if (!tts.enabled) return this.destroy()
    this.updateConfig(tts)
  }

  private getDocument(getReader: () => any) {
    const view = getReader()?.getView?.()
    let doc: Document | null = null, renderer: any = null, location: any = null
    if (view?.renderer) doc = view.renderer.getContents?.()?.[0]?.doc, renderer = view.renderer, location = view.lastLocation
    if (!doc?.body) doc = document, renderer = null
    return { view, doc, renderer, location }
  }

  private getVisibleRange(renderer: any, doc: Document, location?: any) {
    try {
      if (renderer?.lastVisibleRange) return renderer.lastVisibleRange
      if (location?.range) return location.range
      for (const tag of ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']) {
        for (const el of Array.from(doc.querySelectorAll(tag))) {
          const text = el.textContent?.trim()
          if (text && text.length > 10) { const range = doc.createRange(); range.selectNodeContents(el); return range }
        }
      }
    } catch {}
  }

  private reset() {
    this.isActive.value = this.paused.value = this.isLoading.value = false
    this.player = null
    this.title.value = ''
    this.currentText.value = ''
  }
}

let globalTTSController: TTSController | null = null
export const getTTSController = () => globalTTSController || (globalTTSController = new TTSController())
