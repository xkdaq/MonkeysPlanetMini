// app.js
const { reportVisit } = require('./utils/visit.js')
const { fetchGlobalConfig } = require('./utils/global-config.js')

App({
  globalData: {
    userInfo: null,
    token: null
  },

  onLaunch() {
    // 上报小程序启动访问（PV 统计）
    reportVisit({ eventType: 'page_view' })

    // 拉取后台全局配置（广告总开关等），失败时静默兜底
    fetchGlobalConfig()

    // 从本地存储读取token
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
    }

    // 从本地存储读取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
    }

    // 检查隐私政策同意状态
    this.checkPrivacyAgreement()

    console.log('小程序启动成功')
  },

  // 检查隐私政策同意状态
  checkPrivacyAgreement() {
    const privacyAgreed = wx.getStorageSync('privacy_agreed')
    this.globalData.privacyAgreed = privacyAgreed || false
    return this.globalData.privacyAgreed
  },

  // 获取全局数据
  getGlobalData(key) {
    return this.globalData[key]
  },

  // 设置全局数据
  setGlobalData(key, value) {
    this.globalData[key] = value
    // 同步到本地存储
    if (key === 'token' || key === 'userInfo') {
      wx.setStorageSync(key, value)
    }
  },

  // 清除登录状态
  clearLoginState() {
    this.globalData.token = null
    this.globalData.userInfo = null
    wx.removeStorageSync('token')
    wx.removeStorageSync('userInfo')
    // 跟账号绑定的本地缓存也要一起清，否则换账号后
    // 下一个人会在「我的」看到上一个账号的学习概览
    wx.removeStorageSync('profileStats')
    wx.removeStorageSync('pendingBank')
  }
})
