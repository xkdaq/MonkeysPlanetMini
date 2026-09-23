const api = require('../../utils/api.js')

Page({
  data: {
    banks: [],
    loading: false,
    // 继续上次练习（本地存档，按保存时间倒序）
    progressList: [],
    progressIndex: 0,
    progressCount: 0,
    lastPractice: null,
    // 趣味背诵本地进度
    eduStats: {
      wheelDrawn: 0,
      pairLevel: 1
    }
  },

  onLoad() {
    this.loadBanks()
  },

  onShow() {
    // 只读本地存档，零网络请求，切 tab / 从二级页返回都不会卡
    this.loadLocalProgress()
    this.loadEduStats()
    this.resumePendingBank()
  },

  /**
   * 二级页因「去登录」被 switchTab 销毁时会留下 pendingBank，
   * 登录成功回到本 tab 后自动跳回那个题库；没登录成功就丢弃。
   */
  resumePendingBank() {
    let pending = null
    try {
      pending = wx.getStorageSync('pendingBank')
    } catch (e) {
      return
    }
    if (!pending || !pending.bankId) return

    try { wx.removeStorageSync('pendingBank') } catch (e) { /* 忽略 */ }

    if (!wx.getStorageSync('token')) return   // 没登录成功，不打扰

    const parts = [
      `bankId=${pending.bankId}`,
      `bankName=${encodeURIComponent(pending.bankName || '')}`
    ]
    if (pending.bankDesc) parts.push(`bankDesc=${encodeURIComponent(pending.bankDesc)}`)
    wx.navigateTo({ url: `/pages/exam/bank?${parts.join('&')}` })
  },

  // 读取本地刷题存档，组装「继续上次练习」
  loadLocalProgress() {
    // 存档里可能残留 URL 编码串（历史写入问题），读出来统一兜一层解码；
    // 普通中文串 decode 是无操作，重复调用安全。
    const safeDecode = (v) => {
      if (!v || typeof v !== 'string') return ''
      if (v.indexOf('%') === -1) return v
      try { return decodeURIComponent(v) } catch (e) { return v }
    }

    let list = []
    try {
      const keys = (wx.getStorageInfoSync().keys || []).filter(k => k.indexOf('practice_progress_') === 0)
      keys.forEach((k) => {
        const p = wx.getStorageSync(k)
        if (!p || !p.totalCount) return
        const done = Math.min((p.currentIndex || 0) + 1, p.totalCount)

        // 题库名：优先用存档里的；旧存档没有，就按 bankId 从题库列表反查
        let bankName = safeDecode(p.bankName)
        if (!bankName && p.bankId) {
          const bank = this.data.banks.find(b => b.id == p.bankId)
          if (bank) bankName = bank.name
        }
        // 章节名：优先章节，其次练习方式标题（顺序/随机练习）
        const detail = safeDecode(p.categoryName) || safeDecode(p.title) || '继续练习'
        const label = bankName && bankName !== detail
          ? `${bankName} · ${detail}`
          : (bankName || detail)

        list.push({
          key: k,
          bankId: p.bankId,
          categoryId: p.categoryId,
          practiceType: p.practiceType,
          currentIndex: p.currentIndex || 0,
          title: safeDecode(p.title) || safeDecode(p.categoryName) || '继续练习',
          label,
          done,
          total: p.totalCount,
          percent: Math.round((done / p.totalCount) * 100),
          saveTime: p.saveTime || 0
        })
      })
      list.sort((a, b) => b.saveTime - a.saveTime)
    } catch (e) {
      console.error('读取刷题存档失败:', e)
      list = []
    }

    const cur = this.data.lastPractice
    const next = list[0] || null
    // 内容没变就不 setData，避免无谓重渲染
    if (list.length === this.data.progressCount && cur && next
      && cur.key === next.key && cur.done === next.done && cur.label === next.label) {
      return
    }
    this.setData({
      progressList: list,
      progressIndex: 0,
      progressCount: list.length,
      lastPractice: next
    })
  },

  // 多份存档时切换展示哪一份
  onSwitchProgress() {
    const { progressList, progressIndex } = this.data
    if (progressList.length < 2) return
    const next = (progressIndex + 1) % progressList.length
    this.setData({
      progressIndex: next,
      lastPractice: progressList[next]
    })
  },

  // 继续上次练习
  onContinuePractice() {
    const p = this.data.lastPractice
    if (!p) return
    if (!this.checkLogin()) return
    const parts = [
      `bankId=${p.bankId || ''}`,
      `practiceType=${p.practiceType || 1}`,
      `title=${encodeURIComponent(p.title)}`,
      'autoResume=1'
    ]
    if (p.categoryId) parts.push(`categoryId=${p.categoryId}`)
    const saved = wx.getStorageSync(p.key) || {}
    const clean = (v) => {
      if (!v || typeof v !== 'string') return ''
      if (v.indexOf('%') === -1) return v
      try { return decodeURIComponent(v) } catch (e) { return v }
    }
    const savedBankName = clean(saved.bankName)
    const savedCategoryName = clean(saved.categoryName)
    if (savedBankName) parts.push(`bankName=${encodeURIComponent(savedBankName)}`)
    if (savedCategoryName) parts.push(`categoryName=${encodeURIComponent(savedCategoryName)}`)
    wx.navigateTo({ url: `/pages/practice/practice?${parts.join('&')}` })
  },

  // 读取趣味背诵本地进度
  // 检查登录状态（本项目各页各持一份，与 index/profile 一致）
  checkLogin() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再进行练习',
        showCancel: true,
        cancelText: '取消',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/profile/profile'
            })
          }
        }
      })
      return false
    }
    return true
  },

  loadEduStats() {
    let wheelDrawn = 0
    let pairLevel = 1
    try {
      const history = wx.getStorageSync('edu_wheel_history')
      const list = typeof history === 'string' ? JSON.parse(history) : history
      if (Array.isArray(list)) wheelDrawn = list.length
    } catch (e) { /* 忽略 */ }
    try {
      const pair = wx.getStorageSync('edu_pair_v1')
      const d = typeof pair === 'string' ? JSON.parse(pair) : pair
      if (d) pairLevel = Math.min((d.unlocked || 0) + 1, 12)
    } catch (e) { /* 忽略 */ }

    const cur = this.data.eduStats
    if (cur.wheelDrawn === wheelDrawn && cur.pairLevel === pairLevel) return
    this.setData({ eduStats: { wheelDrawn, pairLevel } })
  },

  goWheel() {
    wx.navigateTo({ url: '/pages/edu/wheel' })
  },

  goPair() {
    wx.navigateTo({ url: '/pages/edu/pair' })
  },

  // 加载题库列表
  async loadBanks() {
    this.setData({ loading: true })
    try {
      const res = await api.exam.getBanks()
      const banks = res.data || []
      this.setData({ 
        banks,
        loading: false 
      })
      // 题库名要靠这份列表反查，拿到后重算一次「继续上次练习」
      this.loadLocalProgress()
    } catch (error) {
      this.setData({ loading: false })
      console.error('加载题库失败:', error)
    }
  },

  // 点题库进二级页（原先是在本页切 viewMode，没有原生返回、tabBar 还在）
  onBankItemTap(e) {
    const bankId = e.currentTarget.dataset.id
    const bank = this.data.banks.find(item => item.id == bankId)
    if (!bank) return
    const parts = [
      `bankId=${bankId}`,
      `bankName=${encodeURIComponent(bank.name || '')}`
    ]
    // 描述是后台可编辑的自由文本，编码后一个中文占 9 字节，
    // 不设上限可能撑爆 navigateTo 的 URL 长度，这里截断兜底
    if (bank.description) {
      parts.push(`bankDesc=${encodeURIComponent(String(bank.description).slice(0, 50))}`)
    }
    wx.navigateTo({ url: `/pages/exam/bank?${parts.join('&')}` })
  },

  // 进「趣味背诵」模块首页
  goEduModule() {
    wx.navigateTo({ url: '/pages/edu/index' })
  },

  // 下拉刷新：一级页只需重拉题库列表
  async onPullDownRefresh() {
    await this.loadBanks()
    wx.stopPullDownRefresh()
  },


  /**
   * 分享好友
   */
  onShareAppMessage() {
    return {
      title: '猴哥星球'
    }
  },

  /**
   * 分享朋友圈
   */
  onShareTimeline() {
    return {
      title: '猴哥星球'
    }
  }
})
