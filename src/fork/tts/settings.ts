/** Fork TTS settings extensions (volume / style / pitch Hz). */

export interface TTSVoice {
  name: string
  displayName: string
  locale: string
  isLocal?: boolean
  gender?: 'Male' | 'Female'
  isOffline?: boolean
}

export interface TTSSettings {
  enabled: boolean
  voice: string
  rate: number
  pitch: number
  volume: number
  style: string
  sentenceGap: number
  paragraphGap: number
  autoTurnPage: boolean
  highlightText: boolean
  favoriteVoices?: TTSVoice[]
}

export const TTS_STYLE_OPTIONS = [
  'general', 'assistant', 'chat', 'customerservice', 'newscast',
  'affectionate', 'calm', 'cheerful', 'gentle', 'lyrical', 'serious',
] as const

/** Migrate legacy pitch multiplier (0.5–2) → Hz offset (-50…50). */
export const migrateTtsPitch = (pitch: unknown) => {
  const n = Number(pitch)
  if (!Number.isFinite(n)) return 0
  if (n > 0 && n <= 2) return Math.round((n - 1) * 50)
  return Math.max(-50, Math.min(50, Math.round(n)))
}

export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  enabled: false,
  voice: 'zh-CN-XiaoxiaoNeural',
  rate: 1.0,
  pitch: 0,
  volume: 0,
  style: 'general',
  sentenceGap: 0,
  paragraphGap: 0.3,
  autoTurnPage: true,
  highlightText: true,
  favoriteVoices: [],
}

export const normalizeTtsSettings = (tts?: Partial<TTSSettings> | null): TTSSettings => {
  const merged = { ...DEFAULT_TTS_SETTINGS, ...(tts || {}) }
  return {
    ...merged,
    pitch: migrateTtsPitch(merged.pitch),
    volume: Math.max(-50, Math.min(50, Math.round(Number(merged.volume) || 0))),
    style: TTS_STYLE_OPTIONS.includes(merged.style as any) ? merged.style : 'general',
    favoriteVoices: Array.isArray(merged.favoriteVoices) ? merged.favoriteVoices : [],
  }
}

/** Fork UI items for Settings.vue TTS section (replaces upstream ttsItems). */
export const forkTtsItems = (r: (k: string, min: number, max: number, step: number, unit?: string) => any) => [
  { key: 'enabled', type: 'checkbox' as const },
  r('rate', 0.5, 2.0, 0.1, 'x'),
  r('pitch', -50, 50, 5, 'Hz'),
  r('volume', -50, 50, 5, '%'),
  { key: 'style', opts: [...TTS_STYLE_OPTIONS], labels: TTS_STYLE_OPTIONS.map(s => `ttsStyle_${s}`) },
  r('sentenceGap', 0, 3, 0.1, 's'),
  r('paragraphGap', 0, 5, 0.1, 's'),
]
