const { openLegalPage } = require('../../utils/legal.js')

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {

  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 阻止冒泡
    onMaskTap() {
      // 点击遮罩不关闭，必须做出选择
    },

    // 不同意
    onDisagree() {
      wx.showModal({
        title: '提示',
        content: '不同意隐私政策将无法使用本小程序，是否退出？',
        confirmText: '退出',
        cancelText: '再看看',
        success: (res) => {
          if (res.confirm) {
            // 用户选择退出
            this.triggerEvent('disagree')
          }
        }
      })
    },

    // 同意
    onAgree() {
      // 保存同意状态
      wx.setStorageSync('privacy_agreed', true)
      wx.setStorageSync('privacy_agreed_time', new Date().toISOString())
      
      this.triggerEvent('agree')
    },

  // 查看用户协议
  onUserAgreement() {
    openLegalPage('agreement')
  },

  // 查看隐私政策
  onPrivacyPolicy() {
    openLegalPage('privacy')
  }
  }
})
