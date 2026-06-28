// app.js
App({
  globalData: {
    userInfo: null,
    token: null
  },

  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

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
  }
})
