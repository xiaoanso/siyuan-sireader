/**
 * 思阅授权管理模块 - 极简版
 * 激活 → 验证 → 每日上报 → 本地加密存储
 */

export interface LicenseInfo {
  userId: string
  userName: string
  type: string
  activatedAt: number
  expiresAt: number
  features: string[]
  // 扩展信息（不存储）
  daysRemaining?: number
  lastVerified?: number
}

export class LicenseManager {
  private static readonly API = 'https://api.745201.xyz'
  private static readonly STORE_KEY = 'sireader_license'  // 统一存储键
  private static readonly REFRESH_DAYS = 7

  // 🎯 激活
  static async activate(code: string, plugin: any) {
    const user = await this.getUser()
    if (!user) return { success: false, error: '请先登录思源账号' }

    try {
      const res = await fetch(`${this.API}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: code.trim().toUpperCase(), 
          userId: user.userId, 
          userName: user.userName 
        })
      })

      const data = await res.json()
      if (!res.ok) return { success: false, error: data.error || '激活失败' }

      const license: LicenseInfo = { 
        userId: user.userId, 
        userName: user.userName, 
        ...data, 
        lastVerified: Date.now() 
      }
      await this.save(license, new Date().toDateString(), plugin)

      return { success: true, message: '激活成功', license: this.enrichInfo(license) }
    }
    catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '激活失败' }
    }
  }

  // ✅ 验证
  static async verify(plugin: any): Promise<boolean> {
    const data = await this.load(plugin)
    if (!data) return false

    const { license, lastReport } = data
    if (this.needRefresh(license)) {
      return await this.refresh(license, plugin)
    }

    this.reportDaily(license, lastReport, plugin).catch(() => {})
    return true
  }

  // 🔄 刷新
  private static async refresh(license: LicenseInfo, plugin: any): Promise<boolean> {
    try {
      const res = await fetch(`${this.API}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: license.userId })
      })

      const data = await res.json()
      if (!res.ok) return false

      Object.assign(license, data, { lastVerified: Date.now() })
      await this.save(license, new Date().toDateString(), plugin)
      return true
    }
    catch {
      return false
    }
  }

  // 📅 每日上报
  private static async reportDaily(license: LicenseInfo, lastReport: string, plugin: any) {
    const today = new Date().toDateString()
    if (lastReport !== today) {
      await this.refresh(license, plugin)
    }
  }

  // ✔️ 检查是否需要刷新
  private static needRefresh(license: LicenseInfo): boolean {
    if (license.expiresAt > 0 && license.expiresAt < Date.now()) return true
    return Date.now() - license.activatedAt > this.REFRESH_DAYS * 86400000
  }

  // 🔐 保存（加密 + 上报日期）
  private static async save(license: LicenseInfo, lastReport: string, plugin: any) {
    const key = await this.deriveKey(license.userId)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(license))
    )

    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)

    await plugin.saveData(this.STORE_KEY, { 
      encrypted: btoa(String.fromCharCode(...combined)),
      lastReport
    })
  }

  // 🔓 读取（解密 + 上报日期）
  private static async load(plugin: any): Promise<{ license: LicenseInfo, lastReport: string } | null> {
    try {
      const data = await plugin.loadData(this.STORE_KEY)
      if (!data?.encrypted) return null

      const user = await this.getUser()
      if (!user) return null

      const key = await this.deriveKey(user.userId)
      const combined = Uint8Array.from(atob(data.encrypted), c => c.charCodeAt(0))
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: combined.slice(0, 12) },
        key,
        combined.slice(12)
      )

      const license = JSON.parse(new TextDecoder().decode(decrypted))
      return { license, lastReport: data.lastReport || '' }
    }
    catch {
      return null
    }
  }

  // 🔑 派生密钥
  private static async deriveKey(userId: string) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(userId.slice(0, 32).padEnd(32, '0')),
      'PBKDF2',
      false,
      ['deriveKey']
    )

    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode('sireader-license'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  // 👤 获取用户
  private static async getUser(): Promise<{ userId: string, userName: string } | null> {
    try {
      const res = await fetch('/api/setting/getCloudUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (res.ok) {
        const { code, data } = await res.json()
        if (code === 0 && data?.userId) {
          return {
            userId: data.userId,
            userName: data.userName || data.userNickname || data.userId
          }
        }
      }
      return null
    }
    catch {
      return null
    }
  }

  // 👤 获取用户头像
  static async getUserAvatar(): Promise<string | null> {
    try {
      const res = await fetch('/api/setting/getCloudUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (res.ok) {
        const { code, data } = await res.json()
        return (code === 0 && data?.userAvatarURL) ? data.userAvatarURL : null
      }
      return null
    }
    catch {
      return null
    }
  }

  // 📊 丰富信息
  private static enrichInfo(license: LicenseInfo): LicenseInfo {
    // 计算剩余天数（永久版不设置此字段）
    if (license.expiresAt > 0) {
      license.daysRemaining = Math.max(0, Math.floor((license.expiresAt - Date.now()) / 86400000))
    }
    return license
  }

  // 🗑️ 清除
  static async clear(plugin: any) {
    await plugin.saveData(this.STORE_KEY, null)
  }

  // 📖 获取许可证（带丰富信息 + 自动验证上报）
  static async getLicense(plugin: any): Promise<LicenseInfo | null> {
    // 先验证和上报
    await this.verify(plugin)
    
    // 再读取许可证
    const data = await this.load(plugin)
    return data ? this.enrichInfo(data.license) : null
  }
}
