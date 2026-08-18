const { getHomeIndexData } = require('../../utils/article-api.js')
const { canViewToday, recordView } = require('../../utils/viewLimit.js')
const { isAdEnabled, isReviewMode } = require('../../utils/global-config.js')
const app = getApp()

// 激励视频广告实例
let videoAd = null

Page({
  data: {
    // 轮播图
    bannerList: [],
    // 公告
    noticeList: [],
    // 文章列表
    articleList: [],
    // 网盘文章列表
    panArticleList: [],
    // 公告滚动索引
    noticeCurrent: 0,
    // 公告定时器
    noticeTimer: null,
    // 加载状态
    isLoading: false,
    isError: false,
    // 用户信息
    userInfo: null,
    isLogin: false,
    // 待跳转的网盘信息
    pendingId: null,
    pendingType: null,
    // 隐私授权弹窗
    showPrivacyModal: false
  },

  onLoad() {
    this.checkLoginStatus()
    this.loadHomeData()
    this.startNoticeScroll()
    this.initAd()
  },

  initAd() {
    if (wx.createRewardedVideoAd) {
      videoAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-3de68786b5ee28bd'
      })

      videoAd.onLoad(() => {
        console.log('广告加载成功')
      })

      videoAd.onError((err) => {
        console.error('广告加载错误', err)
      })

      videoAd.onClose((res) => {
        if (res && res.isEnded) {
          console.log('用户完整观看广告，允许跳转')
          const { pendingId } = this.data
          if (pendingId) {
            wx.navigateTo({
              url: `/pages/detail/detail?id=${pendingId}&type=material`
            })
          }
        } else {
          wx.showToast({
            title: '需要完整观看广告才能查看内容',
            icon: 'none'
          })
        }
      })
    }
  },

  onShow() {
    this.checkLoginStatus()
  },

  onPullDownRefresh() {
    this.loadHomeData()
    wx.stopPullDownRefresh()
  },

  onHide() {
    this.stopNoticeScroll()
  },

  onUnload() {
    this.stopNoticeScroll()
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    
    if (token && userInfo) {
      this.setData({
        isLogin: true,
        userInfo
      })
    }
  },

  async loadHomeData() {
    try {
      this.setData({ isLoading: true })
      wx.showLoading({ title: '加载中...', mask: true })
      
      const res = await getHomeIndexData(3, 3, 10, 0)
      
      this.setData({
        bannerList: res.bannerList || [],
        noticeList: res.noticeList || [],
        articleList: res.articleList || [],
        panArticleList: res.panArticleList || [],
        isLoading: false,
        isError: false
      })
    } catch (error) {
      console.error('加载首页数据失败:', error)
      this.setData({ isError: true })
    } finally {
      wx.hideLoading()
      wx.stopPullDownRefresh()
    }
  },

  // 公告滚动
  startNoticeScroll() {
    if (this.data.noticeTimer) return
    const timer = setInterval(() => {
      const { noticeList, noticeCurrent } = this.data
      if (noticeList.length > 1) {
        this.setData({
          noticeCurrent: (noticeCurrent + 1) % noticeList.length
        })
      }
    }, 3000)
    this.setData({ noticeTimer: timer })
  },

  stopNoticeScroll() {
    if (this.data.noticeTimer) {
      clearInterval(this.data.noticeTimer)
      this.setData({ noticeTimer: null })
    }
  },

  // 公告点击
  onNoticeTap(e) {
    const item = e.currentTarget.dataset.item
    if (item.content) {
      wx.showModal({
        title: item.title,
        content: item.content,
        showCancel: false
      })
    }
  },

  // 文章项点击
  onArticleItemTap(e) {
    const item = e.currentTarget.dataset.item
    const { id, type, content } = item

    const isHTML = /<\/?[a-z][\s\S]*>/i.test(content)
    const contentNew = isHTML ? content.replace(/<[^>]+>/g, '') : content

    if (!canViewToday()) {
      wx.showModal({
        title: '提示',
        content: '今天首页查看次数已用完，试试上方搜索功能吧',
        confirmText: '搜索',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.goToSearch()
          }
        }
      })
      return
    }
    recordView()

    this.navigateByType(type, id, contentNew)
  },

  // 网盘项点击
  onPanItemTap(e) {
    const item = e.currentTarget.dataset.item
    const { id, accessType, content } = item

    const isHTML = /<\/?[a-z][\s\S]*>/i.test(content)
    const contentNew = isHTML ? content.replace(/<[^>]+>/g, '') : content

    // 保存待跳转的信息
    this.setData({
      pendingId: id,
      pendingType: accessType
    })

    // 后台总开关开启时，accessType === 2 需要观看广告；开关关闭时全部直接查看
    if (isAdEnabled() && accessType === 2 && videoAd) {
      wx.showModal({
        title: '提示',
        content: '观看一段广告，即可获得资源',
        confirmText: '观看广告',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            videoAd.show().catch(() => {
              videoAd.load().then(() => videoAd.show())
            })
          }
        }
      })
    } else {
      wx.navigateTo({
        url: `/pages/detail/detail?id=${id}&type=material`
      })
    }
  },

  // 根据类型跳转
  navigateByType(type, id, content) {
    if (type === 1) {
      // 1 打开外部链接（审核模式下禁用）
      if (isReviewMode()) {
        wx.showToast({ title: '暂不支持打开该链接', icon: 'none' })
        return
      }
      wx.navigateTo({
        url: `/pages/webview/webview?url=${encodeURIComponent(content)}`
      })
    } else if (type === 3) {
      // 3 打开其他小程序
      wx.navigateToMiniProgram({
        appId: content,
        path: '',
        success() {
          console.log('跳转成功')
        },
        fail(err) {
          console.error('跳转失败', err)
          wx.showToast({ title: '跳转失败', icon: 'none' })
        }
      })
    } else {
      // 0 跳转到详情页面
      wx.navigateTo({
        url: `/pages/detail/detail?id=${id}&type=${type}`
      })
    }
  },

  // 查看更多文章
  goToArticleList() {
    wx.navigateTo({
      url: '/pages/article-list/article-list'
    })
  },

  // 查看更多网盘
  goToPanList() {
    wx.navigateTo({
      url: '/pages/pan-list/pan-list'
    })
  },

  // 搜索
  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search?from=home'
    })
  },

  // 轮播图点击
  onBannerTap(e) {
    const item = e.currentTarget.dataset.item
    if (item.linkUrl) {
      // 判断链接类型
      if (item.linkUrl.startsWith('/pages/')) {
        // 小程序内部页面
        wx.navigateTo({
          url: item.linkUrl
        })
      } else if (item.linkUrl.startsWith('http')) {
        // 外部链接（审核模式下禁用）
        if (isReviewMode()) {
          wx.showToast({ title: '暂不支持打开该链接', icon: 'none' })
          return
        }
        wx.navigateTo({
          url: `/pages/webview/webview?url=${encodeURIComponent(item.linkUrl)}`
        })
      }
    }
  },

  // 微信登录
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
      const api = require('../../utils/api.js')
      const res = await api.user.wxLogin(code)
      const { token, userInfo } = res.data
      
      // 保存登录信息
      wx.setStorageSync('token', token)
      wx.setStorageSync('userInfo', userInfo)
      
      this.setData({
        isLogin: true,
        userInfo
      })
      
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (error) {
      console.error('登录失败:', error)
      wx.showToast({ title: '登录失败', icon: 'none' })
    }
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
