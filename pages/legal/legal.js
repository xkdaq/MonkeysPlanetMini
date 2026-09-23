// pages/legal/legal.js
// 法务文本本地页（用户服务协议 / 隐私政策）
// 取代原先的 web-view 外链：web-view 受小程序「业务域名」白名单限制，
// 正式版没配白名单就打不开，线上用户看不到协议。本地渲染没有这个问题。
const content = require('../../utils/legal-content.js')

Page({
  data: {
    title: '',
    meta: '',
    blocks: [],
    copyright: content.COPYRIGHT,
    notFound: false
  },

  onLoad(options) {
    const type = options.type === 'privacy' ? 'privacy' : 'agreement'
    const doc = content[type]

    if (!doc) {
      this.setData({ notFound: true })
      wx.setNavigationBarTitle({ title: '文档' })
      return
    }

    this.setData({
      title: doc.title,
      meta: doc.meta,
      blocks: doc.blocks
    })
    wx.setNavigationBarTitle({ title: doc.title })
  },

  // 长按复制联系邮箱，省得用户手抄
  onCopyEmail() {
    wx.setClipboardData({
      data: 'monkeys.xu@qq.com',
      success: () => wx.showToast({ title: '邮箱已复制', icon: 'none' })
    })
  },

  onShareAppMessage() {
    return { title: `${this.data.title} · 猴哥星球` }
  }
})
