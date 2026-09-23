const api = require('../../utils/api.js')
const { isReviewMode } = require('../../utils/global-config.js')
const app = getApp()

Page({
  data: {
    userInfo: null,
    isLogin: false,
    // 审核模式：隐藏绑定手机号/修改密码入口
    reviewMode: false,
    // 学习概览（先用本地缓存占位，避免切到本 tab 时数字跳动）
    stats: {
      total: 0,
      totalQuestions: 0,
      totalDurationText: '0分钟'
    }
  },

  onLoad() {
    const cachedStats = wx.getStorageSync('profileStats')
    const patch = { reviewMode: isReviewMode() }
    if (cachedStats) patch.stats = cachedStats
    this.setData(patch)
    this.checkLoginStatus()
  },

  onShow() {
    // 只在值真的变化时 setData，避免每次切 tab 都触发整页重渲染
    const reviewMode = isReviewMode()
    if (reviewMode !== this.data.reviewMode) {
      this.setData({ reviewMode })
    }
    this.checkLoginStatus()
    // 每次显示页面时刷新用户信息
    if (this.data.isLogin) {
      this.fetchUserInfo()
      this.fetchStats()
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    const isLogin = !!(token && userInfo)

    // 未变化则不 setData
    if (isLogin === this.data.isLogin) {
      if (!isLogin) return
      const cur = this.data.userInfo
      if (cur && userInfo && cur.id === userInfo.id && cur.nickname === userInfo.nickname
        && cur.avatarUrl === userInfo.avatarUrl && cur.hasPhone === userInfo.hasPhone) {
        return
      }
    }

    this.setData({
      isLogin,
      userInfo: isLogin ? userInfo : null
    })
  },

  // 学习概览：单次轻量请求，拿 pageSize=1 只为取汇总数字
  async fetchStats() {
    try {
      const res = await api.practice.getRecords(1, 1)
      const { total = 0, totalQuestions = 0, totalDurationText = '0分钟' } = res.data || {}
      const stats = { total, totalQuestions, totalDurationText }
      const cur = this.data.stats
      if (cur.total === total && cur.totalQuestions === totalQuestions
        && cur.totalDurationText === totalDurationText) {
        return
      }
      wx.setStorageSync('profileStats', stats)
      this.setData({ stats })
    } catch (error) {
      // 概览失败不打扰用户，保留上一次的数字
      console.error('获取学习概览失败:', error)
    }
  },

  // 获取最新用户信息
  async fetchUserInfo() {
    try {
      const res = await api.user.getUserInfo()
      const userInfo = res.data
      
      // 更新本地存储
      wx.setStorageSync('userInfo', userInfo)
      
      this.setData({
        userInfo
      })
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  },

  // 登录
  onLogin() {
    wx.login({
      success: (res) => {
        if (res.code) {
          this.doLogin(res.code)
        }
      }
    })
  },

  // 执行登录
  async doLogin(code) {
    try {
      const res = await api.user.wxLogin(code)
      const { token, userInfo } = res.data
      
      app.setGlobalData('token', token)
      app.setGlobalData('userInfo', userInfo)
      
      this.setData({
        isLogin: true,
        userInfo
      })
      
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '登录失败', icon: 'none' })
    }
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearLoginState()
          wx.removeStorageSync('profileStats')
          this.setData({
            isLogin: false,
            userInfo: null,
            stats: { total: 0, totalQuestions: 0, totalDurationText: '0分钟' }
          })
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  },

  // 编辑资料
  onEditProfile() {
    wx.navigateTo({
      url: '/pages/profile/edit'
    })
  },

  // 绑定手机号
  onBindPhone() {
    if (!this.data.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/profile/bind-phone'
    })
  },

  // 修改密码
  onChangePassword() {
    if (!this.data.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/profile/change-password'
    })
  },

  // 学习记录
  onStudyRecords() {
    wx.navigateTo({
      url: '/pages/profile/records'
    })
  },

  // 关于我们
  onAbout() {
    wx.navigateTo({
      url: '/pages/profile/about'
    })
  },

  // 给个好评
  onRateApp() {
    // 跳转到小程序评价页面
    if (wx.canIUse('openEmbeddedMiniProgram')) {
      wx.openEmbeddedMiniProgram({
        appId: 'wxe660d62d3d9d3a00',
        path: 'pages/index/index',
        success: () => {
          console.log('打开小程序成功')
        },
        fail: () => {
          wx.showToast({ title: '跳转失败', icon: 'none' })
        }
      })
    } else {
      // 低版本兼容：提示用户手动评价
      wx.showModal({
        title: '给个好评',
        content: '感谢您的支持！请在小程序详情页点击"..."->"关于"->"赞赏"给我们好评',
        showCancel: false
      })
    }
  },

  // 跳转到设置页面
  goToSettings() {
    wx.navigateTo({
      url: '/pages/setting/setting'
    })
  },

  // 问题反馈
  onFeedback() {
    if (!this.data.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    })
  },


  /**
   * 分享好友
   */
  onShareAppMessage() {
    return {
      title: '猴哥星球'
    }
  },

  /**
   * 分享朋友圈
   */
  onShareTimeline() {
    return {
      title: '猴哥星球'
    }
  }
})
