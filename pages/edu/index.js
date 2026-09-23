// pages/edu/edu.js
// 教育学 · 趣味背诵 模块首页

const { reportVisit } = require('../../utils/visit.js')

const PAIR_KEY = 'edu_pair_v1'
const WHEEL_HISTORY_KEY = 'edu_wheel_history'

Page({
  data: {
    // 连连看进度
    pairLevel: 0,      // 已解锁到第几关（1 起）
    pairCleared: 0,    // 累计消除组数
    pairWrong: 0,      // 错题数
    // 转盘进度
    wheelDrawn: 0,     // 累计抽题次数
    wheelBankCount: 0  // 已抽过的题库数
  },

  onLoad() {
    reportVisit({
      eventType: 'edu_module_view',
      materialTitle: '教育学 · 趣味背诵'
    })
  },

  onShow() {
    this.loadProgress()
  },

  // 读取本地进度（两个玩法的存档都写在本地 storage）
  loadProgress() {
    let pairLevel = 0
    let pairCleared = 0
    let pairWrong = 0
    try {
      const pair = wx.getStorageSync(PAIR_KEY)
      if (pair) {
        const d = typeof pair === 'string' ? JSON.parse(pair) : pair
        pairLevel = Math.min((d.unlocked || 0) + 1, 12)
        pairCleared = d.cleared || 0
        pairWrong = Array.isArray(d.wrongSet) ? d.wrongSet.length : 0
      }
    } catch (e) {
      console.error('读取连连看进度失败:', e)
    }

    let wheelDrawn = 0
    let wheelBankCount = 0
    try {
      const history = wx.getStorageSync(WHEEL_HISTORY_KEY)
      if (history) {
        const list = typeof history === 'string' ? JSON.parse(history) : history
        if (Array.isArray(list)) {
          wheelDrawn = list.length
          const banks = {}
          list.forEach((item) => { banks[item.bankId] = 1 })
          wheelBankCount = Object.keys(banks).length
        }
      }
    } catch (e) {
      console.error('读取转盘记录失败:', e)
    }

    this.setData({ pairLevel, pairCleared, pairWrong, wheelDrawn, wheelBankCount })
  },

  goWheel() {
    wx.navigateTo({ url: '/pages/edu/wheel' })
  },

  goPair() {
    wx.navigateTo({ url: '/pages/edu/pair' })
  },

  /**
   * 分享好友
   */
  onShareAppMessage() {
    return { title: '教育学 · 趣味背诵｜333 教育综合，边玩边记' }
  },

  /**
   * 分享朋友圈
   */
  onShareTimeline() {
    return { title: '教育学 · 趣味背诵｜333 教育综合，边玩边记' }
  }
})
