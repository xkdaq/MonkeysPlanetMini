const { MAX_VIEWS_PER_DAY } = require('../../utils/viewLimit.js')
const { API_VERSION } = require('../../utils/article-api.js')

let logoClickCount = 0
let logoClickTimer = null

Page({
  data: {
    version: '',
    versionCode: ''
  },

  onLoad() {
    const accountInfo = wx.getAccountInfoSync()
    const version = accountInfo?.miniProgram?.version || '开发版'
    this.setData({
      version: version,
      versionCode: API_VERSION
    })
  },

  onLogoTap() {
    logoClickCount += 1

    if (logoClickCount >= 2) {
      // 已点 2 次，加 1 次机会
      let count = wx.getStorageSync('view_count') || 0
      count -= 1
      wx.setStorageSync('view_count', count)

      wx.showToast({
        title: `查看次数 +1（今日可用 ${MAX_VIEWS_PER_DAY - count} 次）`,
        icon: 'none'
      })

      logoClickCount = 0
      if (logoClickTimer) {
        clearTimeout(logoClickTimer)
        logoClickTimer = null
      }
    } else {
      // 设置 2 秒内有效，否则清零
      if (logoClickTimer) clearTimeout(logoClickTimer)
      logoClickTimer = setTimeout(() => {
        logoClickCount = 0
        logoClickTimer = null
      }, 2000)
    }
  }
})
