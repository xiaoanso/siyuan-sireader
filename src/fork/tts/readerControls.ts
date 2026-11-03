import { computed, type ComputedRef, type Ref } from 'vue'
import { showMessage } from 'siyuan'
import { getTTSController } from '@/services/TTSPlayer'

export type ReaderTtsDeps = {
  getReader: () => any
  currentView: Ref<any>
  currentSettings: Ref<any>
  isEmbedPdfMode: ComputedRef<boolean>
  embedPdfPages: Ref<any>
  i18n: ComputedRef<any>
  can: ComputedRef<(feature: string) => boolean>
  showUpgrade: (name: string) => void
  getBookName: () => string
  isEpubScrollMode: () => boolean
  clearReadingSelection?: () => void
}

export function createReaderTtsControls(deps: ReaderTtsDeps) {
  const ttsController = getTTSController()
  const ttsEnabled = computed(() => deps.currentSettings.value?.tts?.enabled || false)
  const ttsActive = computed(() => ttsController.isActive.value)
  const ttsLoading = computed(() => ttsController.isLoading.value)
  const ttsPaused = computed(() => ttsController.paused.value)
  const ttsPlaying = computed(() => ttsController.isActive.value && !ttsController.paused.value && !ttsController.isLoading.value)

  const getReadingSelection = () => {
    try {
      const reader = deps.getReader()
      for (const { doc } of reader?.getView?.()?.renderer?.getContents?.() || []) {
        const sel = doc.defaultView?.getSelection?.()
        if (sel && !sel.isCollapsed && sel.rangeCount) {
          const text = sel.toString().trim()
          if (text) return { text, range: sel.getRangeAt(0).cloneRange() }
        }
      }
      const sel = document.getSelection()
      if (sel && !sel.isCollapsed && sel.rangeCount) {
        const text = sel.toString().trim()
        if (text) return { text, range: sel.getRangeAt(0).cloneRange() }
      }
    } catch {}
  }

  const startTTS = async (fromPageOnly = false) => {
    const tts = deps.currentSettings.value?.tts
    if (deps.isEmbedPdfMode.value) {
      if (!fromPageOnly) {
        const selected = await deps.currentView.value?.getSelectionText?.()
        if (selected?.trim()) return ttsController.restartText(selected.trim(), tts, '选中文本', true)
      }
      const page = deps.embedPdfPages.value?.getCurrentPage?.() || 1
      const text = await deps.currentView.value?.getPageText?.(page)
      if (!text?.trim()) return showMessage(deps.i18n.value.ttsNoText || '当前页无文本', 2000, 'info')
      return ttsController.restartText(text.trim(), tts, deps.getBookName(), false)
    }
    const selection = fromPageOnly ? undefined : getReadingSelection()
    deps.clearReadingSelection?.()
    return ttsController.restart(() => deps.getReader(), tts, selection?.range ? { text: selection.text, range: selection.range } : undefined, deps.getBookName())
  }

  const toggleTTS = async () => {
    if (!deps.can.value('tts')) return deps.showUpgrade(deps.i18n.value.ttsReading || 'TTS朗读')
    if (ttsController.isActive.value) return ttsController.togglePause()
    return startTTS(false)
  }

  const restartTTS = async () => {
    if (!deps.can.value('tts')) return deps.showUpgrade(deps.i18n.value.ttsReading || 'TTS朗读')
    return startTTS(true)
  }

  const jumpTTS = async (delta: number) => {
    if (deps.isEmbedPdfMode.value) {
      return deps.embedPdfPages.value?.[delta < 0 ? 'scrollToPreviousPage' : 'scrollToNextPage']?.('smooth')
    }
    const reader = deps.getReader()
    if (!reader) return
    if (deps.isEpubScrollMode()) return delta < 0 ? reader.prev() : reader.next()
    return delta < 0 ? reader.goLeft() : reader.goRight()
  }

  const stopTTS = () => ttsController.destroy()
  const syncTTS = async () => ttsController.sync(deps.currentSettings.value?.tts)

  return {
    ttsController,
    ttsEnabled,
    ttsActive,
    ttsLoading,
    ttsPaused,
    ttsPlaying,
    startTTS,
    toggleTTS,
    restartTTS,
    jumpTTS,
    stopTTS,
    syncTTS,
  }
}
