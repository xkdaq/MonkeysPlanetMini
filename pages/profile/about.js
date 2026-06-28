const { openLegalPage } = require('../../utils/legal.js')

Page({
  data: {
    version: '1.0.8',
    appName: '猴哥星球'
  },

  onLoad() {
    // 获取小程序版本信息
    const accountInfo = wx.getAccountInfoSync()
    if (accountInfo && accountInfo.miniProgram) {
      this.setData({
        version: accountInfo.miniProgram.version || '1.0.0'
      })
    }
  },

  // 联系我们
  onContact() {
    wx.showModal({
      title: '联系我们',
      content: '如有问题或建议，请联系：\n邮箱：monkeys.xu@qq.com',
      showCancel: false
    })
  },

  // 用户协议
  onUserAgreement() {
    openLegalPage('agreement')
  },

  // 隐私政策
  onPrivacyPolicy() {
    openLegalPage('privacy')
  }
})
