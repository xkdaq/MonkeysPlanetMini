const { getArticleDetail } = require('../../utils/article-api.js')
const { getMaterialDetail } = require('../../utils/material-api.js')
const { reportVisit } = require('../../utils/visit.js')

Page({
  data: {
    title: '',
    htmlContent: '',
    type: 0,
    // 当前资料/文章ID（用于统计上报）
    materialId: null,
    // 资料详情专用字段
    categoryList: [],
    baiduUrl: '',
    quarkUrl: '',
    baiduCode: '',
    quarkCode: '',
    linkRemark: ''
  },

  async onLoad(options) {
    const id = options?.id
    const type = options?.type || '0'
    console.log('拿到的 id 是：', id, 'type:', type)
    this.setData({ type })

    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      return
    }

    // 后端 materialId 为 Long，统一转数字
    this.setData({ materialId: parseInt(id) || null })

    try {
      let res
      if (type === 'material') {
        res = await getMaterialDetail(id)
      } else {
        res = await getArticleDetail(id)
      }

      const data = {
        title: res.title,
        htmlContent: res.content
      }

      // 资料类型 - 填充网盘字段
      if (type === 'material') {
        data.categoryList = res.categoryList || []
        data.baiduUrl = res.baiduUrl || ''
        data.quarkUrl = res.quarkUrl || ''
        data.baiduCode = res.baiduCode || ''
        data.quarkCode = res.quarkCode || ''
        data.linkRemark = res.linkRemark || ''
      }

      this.setData(data)

      // 上报详情查看：资料报 detail_view，文章报 note_detail_view（与后台统计口径一致）
      reportVisit({
        eventType: type === 'material' ? 'detail_view' : 'note_detail_view',
        materialId: this.data.materialId,
        materialTitle: res.title
      })
    } catch (e) {
      console.error('加载失败:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onLinkTap(e) {
    const link = e.detail.href
    if (link.startsWith('http')) {
      wx.navigateTo({
        url: `/pages/webview/webview?url=${encodeURIComponent(link)}`
      })
    } else {
      wx.showToast({ title: '暂不支持的链接', icon: 'none' })
    }
  },

  // 网盘卡片点击
  onPanTap(e) {
    const { url, code, pan } = e.currentTarget.dataset

    // 上报网盘链接点击（baidu_click / quark_click）
    if (pan === 'baidu' || pan === 'quark') {
      reportVisit({
        eventType: `${pan}_click`,
        materialId: this.data.materialId,
        materialTitle: this.data.title
      })
    }

    if (code) {
      wx.setClipboardData({
        data: code,
        success: () => {
          wx.showToast({ title: '提取码已复制', icon: 'success' })
        }
      })
    }

    wx.showModal({
      title: '网盘链接',
      content: '是否复制网盘链接？',
      confirmText: '复制链接',
      showCancel: false,
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: url,
            success: () => {
              wx.showToast({ title: '链接已复制', icon: 'success' })
            }
          })
        }
      }
    })
  },

  /**
   * 分享好友
   */
  onShareAppMessage() {
    return {
      title: this.data.title || '猴哥星球'
    }
  },

  /**
   * 分享朋友圈
   */
  onShareTimeline() {
    return {
      title: this.data.title || '猴哥星球'
    }
  }
})
