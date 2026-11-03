import { unlockAllFeatures } from './license'

/** Apply secondary-development overlays. This branch: membership unlock only. */
export function applyFork() {
  unlockAllFeatures()
}
