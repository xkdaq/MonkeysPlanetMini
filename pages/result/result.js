Page({
  data: {
    correct: 0,
    wrong: 0,
    total: 0,
    duration: 0,
    accuracy: 0
  },

  onLoad(options) {
    const correct = parseInt(options.correct) || 0
    const wrong = parseInt(options.wrong) || 0
    const total = parseInt(options.total) || 0
    const duration = parseInt(options.duration) || 0
    
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
    
    this.setData({
      correct,
      wrong,
      total,
      duration,
      accuracy
    })
  },

  // 格式化时间
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}分${secs}秒`
  },

  // 获取评价
  getEvaluation() {
    const accuracy = this.data.accuracy
    if (accuracy >= 90) return '太棒了！继续保持！'
    if (accuracy >= 80) return '做得不错，再接再厉！'
    if (accuracy >= 60) return '还有提升空间，继续加油！'
    return '需要多加练习，不要气馁！'
  },

  // 返回首页
  onBackHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 查看错题
  onViewWrongs() {
    wx.redirectTo({
      url: '/pages/wrong/wrong?bankId='
    })
  },

  // 再来一次
  onRetry() {
    wx.navigateBack()
  }
})
