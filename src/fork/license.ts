import { LicenseManager, type LicenseInfo } from '@/core/license'

/** Unlock all paid features (secondary-development override). */
export function unlockAllFeatures() {
  LicenseManager.can = (_feature: string, _license: LicenseInfo | null) => true
}
