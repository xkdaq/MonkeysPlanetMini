const api = require('../../utils/api.js')

Page({
  data: {
    records: [],
    loading: false,
    hasMore: true,
    pageNum: 1,
    pageSize: 10,
    stats: {
      total: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      totalDurationText: '0秒'
    }
  },

  onLoad() {
    this.loadRecords()
  },

  onPullDownRefresh() {
    this.setData({
      pageNum: 1,
      records: [],
      hasMore: true
    })
    this.loadRecords().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadRecords()
    }
  },

  // 加载学习记录
  async loadRecords() {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      const { pageNum, pageSize } = this.data
      const res = await api.practice.getRecords(pageNum, pageSize)
      const { list, total, totalQuestions, totalCorrect, totalDurationText } = res.data
      
      const records = pageNum === 1 ? list : [...this.data.records, ...list]
      
      this.setData({
        records,
        stats: {
          total,
          totalQuestions,
          totalCorrect,
          totalDurationText
        },
        pageNum: pageNum + 1,
        hasMore: records.length < total,
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 查看记录详情
  onRecordTap(e) {
    const { id } = e.currentTarget.dataset
    // 可以跳转到详情页，暂时提示
    wx.showToast({ title: '功能开发中', icon: 'none' })
  }
})