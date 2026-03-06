import { ref } from 'vue'
import { showMessage } from 'siyuan'
import { LicenseManager, type LicenseInfo } from '@/core/license'

export function useLicense(plugin: any, i18n: any) {
  const license = ref<LicenseInfo | null>(null)
  const userAvatar = ref<string | null>(null)
  const code = ref('')
  const loading = ref(false)
  const activating = ref(false)

  const load = async () => {
    loading.value = true
    try {
      license.value = await LicenseManager.getLicense(plugin)
      if (license.value) {
        userAvatar.value = await LicenseManager.getUserAvatar()
      }
    }
    finally {
      loading.value = false
    }
  }

  const activate = async () => {
    if (!code.value.trim()) {
      showMessage(i18n.enterActivationCode || '请输入激活码', 2000, 'error')
      return
    }
    activating.value = true
    try {
      const result = await LicenseManager.activate(code.value, plugin)
      if (result.success) {
        license.value = result.license || null
        if (license.value) {
          userAvatar.value = await LicenseManager.getUserAvatar()
        }
        code.value = ''
        showMessage(result.message || '激活成功', 2000, 'info')
      }
      else {
        showMessage(result.error || '激活失败', 3000, 'error')
      }
    }
    catch (error) {
      showMessage(error instanceof Error ? error.message : '激活失败', 3000, 'error')
    }
    finally {
      activating.value = false
    }
  }

  const clear = async () => {
    await LicenseManager.clear(plugin)
    license.value = null
    userAvatar.value = null
    showMessage(i18n.licenseCleared || '授权已清除', 2000, 'info')
  }

  const status = () => {
    if (!license.value)
      return i18n.notActivated || '未激活'
    const names = { free: i18n.freeVersion || '免费版', trial: i18n.trialVersion || '体验版', monthly: i18n.monthlyVersion || '月付版', annual: i18n.annualVersion || '年付版', lifetime: i18n.lifetimeVersion || '永久版' }
    const name = names[license.value.type] || license.value.type
    if (license.value.type === 'free' || license.value.type === 'lifetime')
      return name
    const days = Math.floor((license.value.expiresAt - Date.now()) / 86400000)
    return `${name}（${i18n.remaining || '剩余'} ${days} ${i18n.days || '天'}）`
  }

  return { license, userAvatar, code, loading, activating, load, activate, clear, status }
}
