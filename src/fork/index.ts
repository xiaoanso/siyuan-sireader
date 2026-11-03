import { unlockAllFeatures } from './license'
import { injectForkIcons } from './icons'

/** Apply all secondary-development overlays. Call once during plugin init. */
export function applyFork() {
  unlockAllFeatures()
  try { injectForkIcons() } catch {}
}
