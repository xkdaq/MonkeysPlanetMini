const { getMaterialList, getMaterialSubjects, getMaterialCategories } = require('../../utils/material-api.js')

// 激励视频广告实例
let videoAd = null

Page({
  data: {
    list: [],
    subjects: [],
    categories: [],
    activeSubjectId: '',
    activeCategoryId: '',
    pageNum: 1,
    pageSize: 12,
    hasMore: true,
    loadingMore: false,
    isLoading: false,
    pendingId: null,
    pendingAccessType: null
  },

  async onLoad() {
    await this.loadSubjects()
    await this.loadList(true)

    // 初始化激励视频广告实例
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

  async onPullDownRefresh() {
    this.setData({ pageNum: 1, hasMore: true })
    await this.loadSubjects()
    await this.loadList(true)
    wx.stopPullDownRefresh()
  },

  async onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return
    this.setData({ loadingMore: true })
    await this.loadList(false)
    this.setData({ loadingMore: false })
  },

  async loadSubjects() {
    const subjects = await getMaterialSubjects()
    console.log('拉取科目结果:', subjects)
    this.setData({ subjects })
    await this.loadCategories(this.data.activeSubjectId)
  },

  async loadCategories(subjectId = '') {
    const categories = await getMaterialCategories(subjectId)
    console.log('拉取分类结果:', categories)
    this.setData({ categories })
  },

  async loadList(refresh) {
    let { pageNum, pageSize, list, activeSubjectId, activeCategoryId } = this.data

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

      const res = await getMaterialList(pageNum, pageSize, {
        subjectId: activeSubjectId,
        categoryId: activeCategoryId
      })

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

  async onSubjectTap(e) {
    const subjectId = e.currentTarget.dataset.id || ''
    this.setData({
      activeSubjectId: subjectId,
      activeCategoryId: '',
      pageNum: 1,
      hasMore: true,
      list: []
    })
    await this.loadCategories(subjectId)
    await this.loadList(true)
  },

  async onCategoryTap(e) {
    const categoryId = e.currentTarget.dataset.id || ''
    this.setData({
      activeCategoryId: categoryId,
      pageNum: 1,
      hasMore: true,
      list: []
    })
    await this.loadList(true)
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

    // accessType=2 需要看广告
    if (accessType === 2 && videoAd) {
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
      // accessType=1 免费直接查看
      wx.navigateTo({
        url: `/pages/detail/detail?id=${id}&type=material`
      })
    }
  },

  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search?from=wangpan'
    })
  },

  /**
   * 分享好友
   */
  onShareAppMessage() {
    return {
      title: '猴哥星球 - 网盘资源'
    }
  },

  /**
   * 分享朋友圈
   */
  onShareTimeline() {
    return {
      title: '猴哥星球 - 网盘资源'
    }
  }
})
