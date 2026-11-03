/** Extra lucide symbols used by fork TTS UI. Injected into the reader icon sprite. */
export const FORK_ICON_SYMBOLS = `
  <symbol id="lucide-chevrons-left" viewBox="0 0 24 24">
    <path d="m11 17-5-5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="m18 17-5-5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="lucide-chevrons-right" viewBox="0 0 24 24">
    <path d="m6 17 5-5-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="m13 17 5-5-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
`

export function injectForkIcons() {
  const sprite = document.querySelector('svg[data-sireader-icons]')
  if (!sprite || sprite.querySelector('#lucide-chevrons-left')) return
  const defs = sprite.querySelector('defs') || sprite
  defs.insertAdjacentHTML('beforeend', FORK_ICON_SYMBOLS)
}
