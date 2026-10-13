/** Factory for EmbedPDF selection "speak" command (fork overlay). */
export function pdfSpeakCommand(props: { i18n?: any; settings?: any }) {
  return [
    'speak',
    props.i18n?.ttsPlay || '朗读',
    'volume',
    async (mark: any) => {
      const { getTTSController } = await import('@/services/TTSPlayer')
      const tts = props.settings?.tts || (window as any).__sireader_settings?.tts
      getTTSController().speak(mark.text, tts)
    },
  ] as const
}
