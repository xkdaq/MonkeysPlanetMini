// pages/profile/about.js
// 关于我们：回答「这个产品是什么」+ 联系方式 + 法务。
// 与设置页的分工：设置页 = 我能改的；本页 = 这是什么、怎么找到人。
const { openLegalPage } = require('../../utils/legal.js')

const CONTACT_EMAIL = 'monkeys.xu@qq.com'

Page({
  data: {
    appName: '猴哥星球',
    version: '',
    year: '',
    email: CONTACT_EMAIL,
    features: [
      { tag: '资料', text: '考研公共课与专业课资料，按科目分类查看' },
      { tag: '题库', text: '真题与模拟题分章节练习，支持答题与背题两种模式' },
      { tag: '背诵', text: '抽题大转盘与帽子题连连看，把知识点做成小游戏' }
    ]
  },

  onLoad() {
    // 版本统一取小程序运行时版本，兜底「开发版」。
    // 改版前这里写死了 '1.0.8'，会随发版过期，而设置页兜底又是「开发版」，两页可能对不上。
    const accountInfo = wx.getAccountInfoSync()
    this.setData({
      version: (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.version) || '开发版',
      year: new Date().getFullYear()
    })
  },

  // 问题反馈：项目已有完整反馈页，不再另起一个「联系我们」弹框
  onFeedback() {
    wx.navigateTo({ url: '/pages/feedback/feedback' })
  },

  // 复制邮箱（改版前是 showModal 弹一段纯文本，用户根本复制不走）
  onCopyEmail() {
    wx.setClipboardData({
      data: CONTACT_EMAIL,
      success: () => wx.showToast({ title: '邮箱已复制', icon: 'none' })
    })
  },

  onUserAgreement() {
    openLegalPage('agreement')
  },

  onPrivacyPolicy() {
    openLegalPage('privacy')
  },

  onShareAppMessage() {
    return { title: '猴哥星球 · 考研资料与题库' }
  }
})
