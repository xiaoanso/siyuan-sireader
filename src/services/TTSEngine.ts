// TTS 引擎：VoiceCraft 风格 HTTP Edge TTS + 语音列表管理
declare const window: any

const TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const VOICES_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_TOKEN}`
const CACHE_TTL = 24 * 60 * 60 * 1000
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const TOKEN_REFRESH_BEFORE_EXPIRY = 3 * 60
const ENDPOINT_URL = 'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0'
const SIGN_KEY_B64 = 'oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw=='
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0'

export const TTS_STYLES = [
  'general', 'assistant', 'chat', 'customerservice', 'newscast',
  'affectionate', 'calm', 'cheerful', 'gentle', 'lyrical', 'serious',
] as const

export const PRESET_VOICES: TTSVoice[] = [
  { name: 'zh-CN-XiaoxiaoNeural', displayName: '晓晓 (女声·温柔)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-YunxiNeural', displayName: '云希 (男声·清朗)', locale: 'zh-CN', gender: 'Male' },
  { name: 'zh-CN-YunyangNeural', displayName: '云扬 (男声·阳光)', locale: 'zh-CN', gender: 'Male' },
  { name: 'zh-CN-XiaoyiNeural', displayName: '晓伊 (女声·甜美)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-YunjianNeural', displayName: '云健 (男声·稳重)', locale: 'zh-CN', gender: 'Male' },
  { name: 'zh-CN-XiaochenNeural', displayName: '晓辰 (女声·知性)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-XiaohanNeural', displayName: '晓涵 (女声·优雅)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-XiaomengNeural', displayName: '晓梦 (女声·梦幻)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-XiaomoNeural', displayName: '晓墨 (女声·文艺)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-XiaoqiuNeural', displayName: '晓秋 (女声·成熟)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-XiaoruiNeural', displayName: '晓睿 (女声·智慧)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-XiaoshuangNeural', displayName: '晓双 (女声·活泼)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-XiaoxuanNeural', displayName: '晓萱 (女声·清新)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-XiaoyanNeural', displayName: '晓颜 (女声·柔美)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-XiaoyouNeural', displayName: '晓悠 (女声·悠扬)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-XiaozhenNeural', displayName: '晓甄 (女声·端庄)', locale: 'zh-CN', gender: 'Female' },
  { name: 'zh-CN-YunfengNeural', displayName: '云枫 (男声·磁性)', locale: 'zh-CN', gender: 'Male' },
  { name: 'zh-CN-YunhaoNeural', displayName: '云皓 (男声·豪迈)', locale: 'zh-CN', gender: 'Male' },
  { name: 'zh-CN-YunxiaNeural', displayName: '云夏 (男声·热情)', locale: 'zh-CN', gender: 'Male' },
  { name: 'zh-CN-YunyeNeural', displayName: '云野 (男声·野性)', locale: 'zh-CN', gender: 'Male' },
  { name: 'zh-CN-YunzeNeural', displayName: '云泽 (男声·深沉)', locale: 'zh-CN', gender: 'Male' },
]

export const toArrayBuffer = (buf: ArrayBuffer | Uint8Array | Buffer) => {
  if (buf instanceof ArrayBuffer) return buf
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf as any)
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
}

export interface TTSVoice {
  name: string
  displayName: string
  locale: string
  gender: 'Male' | 'Female'
  isLocal?: boolean
}

/** Coarse language groups (VoiceCraft-style: zh/en/ja/ko/es/fr/de/ru…). */
export const LANGUAGE_LABELS: Record<string, string> = {
  zh: '中文', en: '英文', ja: '日语', ko: '韩语',
  es: '西班牙语', fr: '法语', de: '德语', ru: '俄语',
  pt: '葡萄牙语', it: '意大利语', nl: '荷兰语', ar: '阿拉伯语',
  th: '泰语', vi: '越南语', id: '印尼语', ms: '马来语',
  hi: '印地语', tr: '土耳其语', pl: '波兰语', sv: '瑞典语',
  da: '丹麦语', fi: '芬兰语', nb: '挪威语', cs: '捷克语',
  el: '希腊语', he: '希伯来语', hu: '匈牙利语', ro: '罗马尼亚语',
  uk: '乌克兰语', other: '其他',
}

const LANGUAGE_ORDER = ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt', 'it'] as const

export const languageOfLocale = (locale?: string) => {
  const raw = (locale || '').trim()
  if (!raw) return 'other'
  const primary = raw.split(/[-_]/)[0]?.toLowerCase() || 'other'
  return primary || 'other'
}

export const languageLabel = (lang: string) => LANGUAGE_LABELS[lang] || LANGUAGE_LABELS[lang.toLowerCase()] || lang || '其他'

const languagePriority = (lang: string) => {
  const i = (LANGUAGE_ORDER as readonly string[]).indexOf(lang)
  return i >= 0 ? i : 100
}

/** Group voices by coarse language (中文/英文/…), not full locale. */
export const groupVoicesByLocale = <T extends { locale?: string; displayName?: string; name?: string }>(voices: T[]) => {
  const map = new Map<string, T[]>()
  for (const v of voices) {
    const lang = languageOfLocale(v.locale)
    if (!map.has(lang)) map.set(lang, [])
    map.get(lang)!.push(v)
  }
  return [...map.entries()]
    .sort(([a], [b]) => languagePriority(a) - languagePriority(b) || a.localeCompare(b))
    .map(([lang, list]) => ({
      locale: lang,
      label: languageLabel(lang),
      voices: [...list].sort((x, y) => {
        const la = (x.locale || '').localeCompare(y.locale || '')
        if (la) return la
        return (x.displayName || x.name || '').localeCompare(y.displayName || y.name || '', 'zh')
      }),
    }))
}

/** @deprecated alias — same coarse language grouping */
export const groupVoicesByLanguage = groupVoicesByLocale
export const localeLabel = (locale: string) => languageLabel(languageOfLocale(locale))

let voiceCache: { at: number; voices: TTSVoice[] } | null = null
let onlineVoiceTask: Promise<TTSVoice[]> | null = null
let localVoiceTask: Promise<TTSVoice[]> | null = null
let localVoiceCache: TTSVoice[] | null = null
let tokenInfo: { endpoint: any; token: string; expiredAt: number } = { endpoint: null, token: '', expiredAt: 0 }

const readVoiceCache = () => {
  if (voiceCache) return voiceCache
  try { return voiceCache = JSON.parse(localStorage.getItem('sireader:tts:voices') || 'null') } catch { return null }
}
const writeVoiceCache = (voices: TTSVoice[]) => {
  voiceCache = { at: Date.now(), voices }
  try { localStorage.setItem('sireader:tts:voices', JSON.stringify(voiceCache)) } catch {}
}

export async function loadOnlineVoices(): Promise<TTSVoice[]> {
  const cached = readVoiceCache()
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.voices
  if (onlineVoiceTask) return onlineVoiceTask
  onlineVoiceTask = (async () => {
    try {
      const res = await fetch(VOICES_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const voices: TTSVoice[] = data.map((v: any) => ({
        name: v.ShortName || v.Name,
        displayName: v.FriendlyName || v.DisplayName || v.ShortName,
        locale: v.Locale,
        gender: v.Gender === 'Male' ? 'Male' : 'Female',
        isLocal: false,
      }))
      writeVoiceCache(voices)
      return voices
    }
    catch {
      return cached?.voices?.length ? cached.voices : PRESET_VOICES
    }
  })().finally(() => { onlineVoiceTask = null })
  return onlineVoiceTask
}

export async function loadLocalVoices(): Promise<TTSVoice[]> {
  if (!('speechSynthesis' in window)) return []
  if (localVoiceCache) return localVoiceCache
  if (localVoiceTask) return localVoiceTask
  localVoiceTask = (async () => {
    let voices = window.speechSynthesis.getVoices()
    if (!voices.length) {
      voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
        const handler = () => {
          const v = window.speechSynthesis.getVoices()
          if (v.length) {
            window.speechSynthesis.removeEventListener('voiceschanged', handler)
            resolve(v)
          }
        }
        window.speechSynthesis.addEventListener('voiceschanged', handler)
        setTimeout(() => {
          window.speechSynthesis.removeEventListener('voiceschanged', handler)
          resolve(window.speechSynthesis.getVoices())
        }, 800)
      })
    }
    return localVoiceCache = voices.map((v: SpeechSynthesisVoice) => ({
      name: v.name,
      displayName: v.name,
      locale: v.lang || '',
      gender: 'Female' as const,
      isLocal: true,
    }))
  })().finally(() => { localVoiceTask = null })
  return localVoiceTask
}

const escapeXmlText = (text: string) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

/** Strip foliate SSML marks/tags → plain speaking text. */
export const plainTextFromSSML = (input: string) => {
  if (!input?.trim()) return ''
  try {
    if (input.includes('<') && typeof DOMParser !== 'undefined') {
      const el = new DOMParser().parseFromString(input, 'application/xml').documentElement
      if (el && el.localName !== 'parsererror' && !el.querySelector('parsererror')) {
        return (el.textContent || '').replace(/\s+/g, ' ').trim()
      }
    }
  }
  catch {}
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const formatRate = (rate = 1) => {
  const n = Math.round((rate - 1) * 100)
  return `${n >= 0 ? '+' : ''}${n}%`
}
const formatPitchHz = (pitchHz = 0) => {
  const n = Math.round(Number(pitchHz) || 0)
  return `${n >= 0 ? '+' : ''}${n}Hz`
}
const formatVolume = (volume = 0) => {
  const n = Math.round(Number(volume) || 0)
  return `${n >= 0 ? '+' : ''}${n}%`
}

const getSsml = (text: string, voiceName: string, rate: string, pitch: string, volume: string, style: string) => {
  const escaped = escapeXmlText(text)
  const safeStyle = TTS_STYLES.includes(style as any) ? style : 'general'
  return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN">
  <voice name="${voiceName}">
    <mstts:express-as style="${safeStyle}" styledegree="2.0" role="default">
      <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">${escaped}</prosody>
    </mstts:express-as>
  </voice>
</speak>`
}

const uuid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/-/g, '')

const dateFormat = () => (`${new Date().toUTCString().replace(/GMT/, '').trim()} GMT`).toLowerCase()

const base64ToBytes = (base64: string) => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let s = ''
  bytes.forEach(b => { s += String.fromCharCode(b) })
  return btoa(s)
}

const hmacSha256 = async (key: Uint8Array, data: string) => {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('WebCrypto is unavailable')
  const cryptoKey = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data)))
}

const sign = async (urlStr: string) => {
  const url = urlStr.split('://')[1]
  const encodedUrl = encodeURIComponent(url)
  const uuidStr = uuid()
  const formattedDate = dateFormat()
  const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase()
  const key = base64ToBytes(SIGN_KEY_B64)
  const signData = await hmacSha256(key, bytesToSign)
  return `MSTranslatorAndroidApp::${bytesToBase64(signData)}::${formattedDate}::${uuidStr}`
}

async function getEndpoint() {
  const now = Date.now() / 1000
  if (tokenInfo.token && tokenInfo.expiredAt && now < tokenInfo.expiredAt - TOKEN_REFRESH_BEFORE_EXPIRY) {
    return tokenInfo.endpoint
  }
  const clientId = uuid()
  try {
    const response = await fetch(ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Accept-Language': 'zh-Hans',
        'X-ClientVersion': '4.0.530a 5fe1dc6c',
        'X-UserId': '0f04d16a175c411e',
        'X-HomeGeographicRegion': 'zh-Hans-CN',
        'X-ClientTraceId': clientId,
        'X-MT-Signature': await sign(ENDPOINT_URL),
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': '0',
      },
    })
    if (!response.ok) throw new Error(`获取 endpoint 失败: ${response.status}`)
    const data = await response.json()
    const jwt = data.t.split('.')[1]
    const decodedJwt = JSON.parse(atob(jwt))
    tokenInfo = { endpoint: data, token: data.t, expiredAt: decodedJwt.exp }
    return data
  }
  catch (error) {
    if (tokenInfo.token) return tokenInfo.endpoint
    throw error
  }
}

export class EdgeTTSCore {
  private voice = 'zh-CN-XiaoxiaoNeural'

  setVoice(voice: string) { if (voice) this.voice = voice }

  close() { /* HTTP 无长连接 */ }

  async toStream(text: string, rate = 1, pitchHz = 0, volume = 0, style = 'general'): Promise<Uint8Array> {
    return this.synthesize(plainTextFromSSML(text) || text, rate, pitchHz, volume, style)
  }

  async toSSMLStream(ssml: string, rate = 1, pitchHz = 0, volume = 0, style = 'general'): Promise<Uint8Array> {
    const text = plainTextFromSSML(ssml)
    if (!text) throw new Error('TTS 文本为空')
    return this.synthesize(text, rate, pitchHz, volume, style)
  }

  private async synthesize(text: string, rate = 1, pitchHz = 0, volume = 0, style = 'general', maxRetries = 3): Promise<Uint8Array> {
    const clean = text.trim()
    if (!clean) throw new Error('TTS 文本为空')
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const endpoint = await getEndpoint()
        const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: endpoint.t,
            'Content-Type': 'application/ssml+xml',
            'User-Agent': USER_AGENT,
            'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
          },
          body: getSsml(clean, this.voice, formatRate(rate), formatPitchHz(pitchHz), formatVolume(volume), style),
        })
        if (!response.ok) {
          const errorText = await response.text().catch(() => '')
          if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
            continue
          }
          throw new Error(`Edge TTS API 错误: ${response.status} ${errorText}`)
        }
        const buf = new Uint8Array(await response.arrayBuffer())
        if (!buf.length) throw new Error('No audio')
        return buf
      }
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < maxRetries && /fetch|network|Failed to fetch|endpoint/i.test(lastError.message)) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
          continue
        }
        if (attempt === maxRetries) break
      }
    }
    throw lastError || new Error('TTS 合成失败')
  }
}
