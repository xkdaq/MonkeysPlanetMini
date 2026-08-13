const { getSearchList } = require('../../utils/article-api.js')
const { getMaterialList } = require('../../utils/material-api.js')
const { isAdEnabled } = require('../../utils/global-config.js')

// 激励视频广告实例
let videoAd = null

Page({
  data: {
    from: '',
    keywords: '',
    placeholder: '请输入关键词进行搜索',
    list: [],
    pageNum: 1,
    pageSize: 12,
    hasMore: true,
    loadingMore: false,
    pendingId: null,
    pendingType: null
  },

  onInputChange(e) {
    this.setData({ keywords: e.detail.value })
  },

  onLoad(options) {
    const from = options.from || ''
    this.setData({
      from: from,
      placeholder: '请输入关键词进行搜索'
    })

    // 初始化激励视频广告实例
    if (wx.createRewardedVideoAd) {
      videoAd = wx.createRewardedVideoAd({
        adUnitId: 'adunit-8e1aae82f75710ac'
      })

      videoAd.onLoad(() => {
        console.log('广告加载成功')
      })

      videoAd.onError((err) => {
        console.error('广告加载错误', err)
      })

      videoAd.onClose((res) => {
        // 用户看完广告（res.isEnded === true）才跳转
        if (res && res.isEnded) {
          console.log('用户完整观看广告，允许跳转')
          wx.navigateTo({
            url: `/pages/detail/detail?id=${this.data.pendingId}&type=${this.data.pendingType}`
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

  async onSearch() {
    this.setData({ pageNum: 1, hasMore: true })
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
    let { pageNum, pageSize, list, keywords, from } = this.data
    if (!keywords.trim()) return

    if (!refresh) {
      pageNum += 1
    } else {
      pageNum = 1
    }

    try {
      wx.showLoading({ title: '加载中...', mask: true })
      let res
      if (from === 'wangpan') {
        res = await getMaterialList(pageNum, pageSize, '', keywords)
      } else {
        res = await getSearchList(pageNum, pageSize, keywords)
      }

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
    }
  },

  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    const { from } = this.data

    if (from === 'wangpan') {
      // 资料搜索结果
      const { id, accessType } = item
      this.setData({
        pendingId: id,
        pendingType: 'material'
      })
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
      return
    }

    // 文章搜索结果
    const { id, type, content } = item
    const isHTML = /<\/?[a-z][\s\S]*>/i.test(content)
    const contentNew = isHTML ? content.replace(/<[^>]+>/g, '') : content

    if (type === 1) {
      // 1 打开外部链接
      wx.navigateTo({
        url: `/pages/webview/webview?url=${encodeURIComponent(contentNew)}`
      })
    } else if (type === 3) {
      // 3 打开其他小程序
      wx.navigateToMiniProgram({
        appId: contentNew,
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
      this.setData({
        pendingId: id,
        pendingType: type
      })
      if (isAdEnabled() && type === 5 && videoAd) {
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
          url: `/pages/detail/detail?id=${id}&type=${type}`
        })
      }
    }
  }
})
