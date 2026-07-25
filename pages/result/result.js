Page({
  data: {
    correct: 0,
    wrong: 0,
    total: 0,
    answered: 0,
    duration: 0,
    accuracy: 0,
    // 预计算的展示文案（WXML 不支持调用页面方法）
    durationText: '',
    evaluation: '',
    // 练习上下文（用于「查看错题」「再来一次」）
    bankId: '',
    categoryId: null,
    practiceType: null,
    questionType: null,
    title: '',
    mode: '' // 'wrong'-错题模式 'favorite'-收藏模式 ''-正常模式
  },

  onLoad(options) {
    const correct = parseInt(options.correct) || 0
    const wrong = parseInt(options.wrong) || 0
    const total = parseInt(options.total) || 0
    const duration = parseInt(options.duration) || 0
    // 已答题数：优先取参数，兜底用 答对+答错，再兜底总题数
    const answered = parseInt(options.answered) || (correct + wrong) || total
    // 正确率按已答题数计算，与上报口径保持一致
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0

    this.setData({
      correct,
      wrong,
      total,
      answered,
      duration,
      accuracy,
      durationText: this.formatTime(duration),
      evaluation: this.getEvaluation(accuracy),
      bankId: options.bankId || '',
      categoryId: options.categoryId ? parseInt(options.categoryId) : null,
      practiceType: options.practiceType ? parseInt(options.practiceType) : null,
      questionType: options.questionType ? parseInt(options.questionType) : null,
      title: options.title ? decodeURIComponent(options.title) : '',
      mode: options.mode || ''
    })
  },

  // 格式化时间
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}分${secs}秒`
  },

  // 获取评价
  getEvaluation(accuracy) {
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
      url: `/pages/wrong/wrong?bankId=${this.data.bankId || ''}`
    })
  },

  // 再来一次
  onRetry() {
    const { mode, bankId, categoryId, practiceType, questionType, title } = this.data

    // 错题/收藏模式没有练习参数，返回列表页重新选择
    if (mode) {
      wx.navigateBack()
      return
    }

    // 练习页已被 redirectTo 销毁，需用 redirectTo 重新进入
    let url = `/pages/practice/practice?bankId=${bankId}&practiceType=${practiceType || 1}&title=${encodeURIComponent(title || '练习')}`
    if (categoryId) url += `&categoryId=${categoryId}`
    if (questionType) url += `&questionType=${questionType}`
    wx.redirectTo({ url })
  }
})
