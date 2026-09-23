// pages/setting/setting.js
// 设置页：收口用户真正可调的偏好 + 只读额度 + 法务入口。
// 改版前这一页没有任何设置项，只有 Logo / 版本号 / 版权，与「关于我们」几乎完全重复。
const { getRemainingViews, MAX_VIEWS_PER_DAY } = require('../../utils/viewLimit.js')
const prefs = require('../../utils/prefs.js')

let versionTapCount = 0
let versionTapTimer = null

Page({
  data: {
    version: '',
    year: '',
    // 学习偏好
    practiceMode: 'answer',
    autoResume: false,
    noRepeat: false,
    // 答题手感（连连看）
    vibrate: true,
    pairReveal: false,
    // 今日额度
    maxViews: MAX_VIEWS_PER_DAY,
    remaining: 0,
    quotaPercent: 0,
    quotaUsedUp: false,
    // 隐私同意状态
    privacyDate: ''
  },

  onLoad() {
    const accountInfo = wx.getAccountInfoSync()
    this.setData({
      version: (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.version) || '开发版',
      year: new Date().getFullYear(),
      privacyDate: this.readPrivacyDate()
    })
  },

  onShow() {
    // 额度会在别的页面被消耗，也可能跨过 0 点，所以每次显示都重算
    this.refreshQuota()
    // 偏好可能在功能页被改过（两个入口读写同一批 key），每次显示都重读
    this.setData({
      practiceMode: prefs.getPracticeMode(),
      autoResume: prefs.getBool('autoResume'),
      noRepeat: prefs.getBool('wheelNoRepeat'),
      vibrate: prefs.getBool('vibrate'),
      pairReveal: prefs.getBool('pairReveal')
    })
  },

  // ===== 今日额度 =====
  refreshQuota() {
    // viewLimit.getRemainingViews() 只做了 Math.max(0, ...)，没有上限钳制；
    // 老用户如果点过旧版彩蛋，view_count 可能是负数，这里会返回大于 10。
    // 展示层再钳一次，避免进度条溢出。
    const raw = getRemainingViews()
    const remaining = Math.min(MAX_VIEWS_PER_DAY, Math.max(0, raw))
    this.setData({
      remaining,
      quotaPercent: Math.round((remaining / MAX_VIEWS_PER_DAY) * 100),
      quotaUsedUp: remaining <= 0
    })
  },

  // ===== 学习偏好 =====
  onPracticeModeTap(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.practiceMode) return
    prefs.setPracticeMode(mode)
    this.setData({ practiceMode: mode })
  },

  onAutoResumeChange(e) {
    const value = !!e.detail.value
    prefs.setBool('autoResume', value)
    this.setData({ autoResume: value })
  },

  onNoRepeatChange(e) {
    const value = !!e.detail.value
    prefs.setBool('wheelNoRepeat', value)
    this.setData({ noRepeat: value })
  },

  // ===== 答题手感 =====
  onVibrateChange(e) {
    const value = !!e.detail.value
    prefs.setBool('vibrate', value)
    this.setData({ vibrate: value })
    // 打开时来一下轻震，给个即时手感
    if (value) {
      try { wx.vibrateShort({ type: 'light' }) } catch (err) { /* 部分机型不支持 */ }
    }
  },

  onPairRevealChange(e) {
    const value = !!e.detail.value
    prefs.setBool('pairReveal', value)
    this.setData({ pairReveal: value })
  },

  // ===== 隐私 =====
  // 只读展示同意状态；协议与政策的入口统一放在「关于我们」页，设置页不重复
  readPrivacyDate() {
    if (!wx.getStorageSync('privacy_agreed')) return ''
    const t = wx.getStorageSync('privacy_agreed_time')
    // privacy-modal 写入的是 ISO 串，取前 10 位就是 YYYY-MM-DD
    return typeof t === 'string' && t.length >= 10 ? t.slice(0, 10) : ''
  },

  /**
   * 页脚版本号连点：退还一次已消耗的查看机会。
   * 原先挂在大 Logo 上，Logo 区与「关于我们」的品牌卡完全重复，改版时把 Logo 去掉了，
   * 彩蛋移到版本号上（安卓经典的「连点版本号」套路），功能不变。
   * 注意 count 必须夹到 0：旧版直接 count -= 1 没有下限，一直点能点成负数，
   * 而 canViewToday() 判断的是 count < MAX_VIEWS_PER_DAY，负数等于无限次查看。
   */
  onVersionTap() {
    versionTapCount += 1

    if (versionTapCount >= 2) {
      const count = wx.getStorageSync('view_count') || 0
      if (count <= 0) {
        wx.showToast({ title: `今日次数已是满额（${MAX_VIEWS_PER_DAY} 次）`, icon: 'none' })
      } else {
        wx.setStorageSync('view_count', count - 1)
        wx.showToast({ title: '查看次数 +1', icon: 'none' })
      }
      this.refreshQuota()

      versionTapCount = 0
      if (versionTapTimer) {
        clearTimeout(versionTapTimer)
        versionTapTimer = null
      }
    } else {
      // 2 秒内连点才算数
      if (versionTapTimer) clearTimeout(versionTapTimer)
      versionTapTimer = setTimeout(() => {
        versionTapCount = 0
        versionTapTimer = null
      }, 2000)
    }
  },

  onShareAppMessage() {
    return { title: '猴哥星球' }
  }
})
