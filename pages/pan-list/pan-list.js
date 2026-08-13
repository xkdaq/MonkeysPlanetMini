const { getMaterialList } = require('../../utils/material-api.js')
const { isAdEnabled } = require('../../utils/global-config.js')

// 激励视频广告实例
let videoAd = null

Page({
  data: {
    keywords: '',
    placeholder: '请输入资料名称进行搜索',
    list: [],
    pageNum: 1,
    pageSize: 12,
    hasMore: true,
    loadingMore: false,
    isLoading: false,
    pendingId: null,
    pendingAccessType: null
  },

  onLoad() {
    this.initAd()
    this.loadList(true)
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
          wx.navigateTo({
            url: `/pages/detail/detail?id=${this.data.pendingId}&type=material`
          })
        } else {
          wx.showToast({
            title: '需要完整观看广告才能查看内容',
            icon: 'none'
          })
        }
      })
    }
  },

  onInputChange(e) {
    this.setData({ keywords: e.detail.value })
  },

  async onSearch() {
    const { keywords } = this.data
    if (!keywords.trim()) {
      wx.showToast({ title: '请输入搜索关键词', icon: 'none' })
      return
    }
    this.setData({ pageNum: 1, hasMore: true })
    await this.loadList(true)
  },

  async onClearSearch() {
    this.setData({ keywords: '', pageNum: 1, hasMore: true })
    await this.loadList(true)
  },

  async onPullDownRefresh() {
    this.setData({ pageNum: 1, hasMore: true })
    await this.loadList(true)
    wx.stopPullDownRefresh()
  },

  async onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return
    this.setData({ loadingMore: true })
    await this.loadList(false)
    this.setData({ loadingMore: false })
  },

  async loadList(refresh) {
    let { pageNum, pageSize, list, keywords } = this.data

    if (!refresh) {
      pageNum += 1
    } else {
      pageNum = 1
    }

    try {
      if (refresh) {
        wx.showLoading({ title: '加载中...', mask: true })
      }
      this.setData({ isLoading: true })

      const res = await getMaterialList(pageNum, pageSize, '', keywords)
      const newList = refresh ? res.data : list.concat(res.data)
      const hasMore = res.data.length >= pageSize

      this.setData({
        list: newList,
        pageNum: pageNum,
        hasMore: hasMore
      })
    } catch (error) {
      console.error('加载失败:', error)
    } finally {
      wx.hideLoading()
      wx.stopPullDownRefresh()
      this.setData({ isLoading: false })
    }
  },

  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    const { id, accessType, content } = item
    const isHTML = /<\/?[a-z][\s\S]*>/i.test(content)
    const contentNew = isHTML ? content.replace(/<[^>]+>/g, '') : content

    this.setData({
      pendingId: id,
      pendingAccessType: accessType
    })

    // 后台总开关开启时，accessType=2 需要看广告；开关关闭时全部直接查看
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

  onShareAppMessage() {
    return {
      title: '猴哥星球 - 网盘资源'
    }
  },

  onShareTimeline() {
    return {
      title: '猴哥星球 - 网盘资源'
    }
  }
})
