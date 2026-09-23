const api = require('../../utils/api.js')

Page({
  data: {
    banks: [],
    viewMode: 'bankList',
    isBankList: true,
    selectedBank: null,
    currentBankId: null,
    currentBankIndex: 0,
    currentBankName: '请选择',
    subjects: [],
    currentSubjectId: null,
    currentSubjectName: '',
    allCategoryTree: [],
    categories: [],
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
    },
    stats: {
      totalQuestions: 0,
      todayQuestions: 0,
      wrongCount: 0,
      favoriteCount: 0
    }
  },

  onLoad() {
    this.loadBanks()
  },

  onShow() {
    // 题库列表态：只读本地存档，零网络请求，切 tab 不会卡
    if (this.data.viewMode === 'bankList') {
      this.loadLocalProgress()
      this.loadEduStats()
      return
    }
    // 每次显示页面时刷新统计数据
    const token = wx.getStorageSync('token')
    const bankId = this.data.currentBankId
    if (this.data.viewMode === 'bankDetail' && token && bankId) {
      this.loadStats()
    }
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
      if (this.data.viewMode === 'bankList') {
        this.loadLocalProgress()
      }
    } catch (error) {
      this.setData({ loading: false })
      console.error('加载题库失败:', error)
    }
  },

  // 点击题库进入详情
  onBankItemTap(e) {
    const bankId = e.currentTarget.dataset.id
    this.selectBank(bankId)
  },

  // 选择题库
  selectBank(bankId) {
    const banks = this.data.banks
    const index = banks.findIndex(item => item.id == bankId)
    const selectedBank = index > -1 ? banks[index] : null
    const name = selectedBank ? selectedBank.name : '请选择'
    
    this.setData({ 
      viewMode: 'bankDetail',
      isBankList: false,
      selectedBank,
      currentBankId: bankId,
      currentBankIndex: index > -1 ? index : 0,
      currentBankName: name
    })
    wx.setNavigationBarTitle({ title: name })
    this.loadCategories(bankId)
    
    // 只有登录后才加载统计数据
    const token = wx.getStorageSync('token')
    if (token) {
      this.loadStats()
    } else {
      // 未登录，重置统计数据
      this.setData({
        'stats.wrongCount': 0,
        'stats.favoriteCount': 0
      })
    }
  },

  // 返回题库列表
  onBackToBanks() {
    this.setData({
      viewMode: 'bankList',
      isBankList: true,
      selectedBank: null,
      currentBankId: null,
      currentBankIndex: 0,
      currentBankName: '请选择',
      subjects: [],
      currentSubjectId: null,
      currentSubjectName: '',
      allCategoryTree: [],
      categories: [],
      stats: {
        totalQuestions: 0,
        todayQuestions: 0,
        wrongCount: 0,
        favoriteCount: 0
      }
    })
    wx.setNavigationBarTitle({ title: '题库' })
  },

  // 加载分类
  async loadCategories(bankId) {
    try {
      const res = await api.exam.getCategoryTree(bankId)
      const result = this.processCategories(res.data || [])
      this.setData({
        subjects: result.subjects,
        currentSubjectId: result.currentSubjectId,
        currentSubjectName: result.currentSubjectName,
        allCategoryTree: result.allCategoryTree,
        categories: result.categories
      })
    } catch (error) {
      console.error('加载分类失败:', error)
    }
  },

  // 处理分类数据，兼容“题库-章-节”和“题库-科目-章-节”
  processCategories(list) {
    const allCategoryTree = this.buildCategoryTree(list)
    const hasSubjectLevel = allCategoryTree.some(item =>
      item.children && item.children.some(child => child.children && child.children.length > 0)
    )

    if (!hasSubjectLevel) {
      return {
        subjects: [],
        currentSubjectId: null,
        currentSubjectName: '',
        allCategoryTree,
        categories: allCategoryTree
      }
    }

    const subjects = allCategoryTree
    const currentSubject = subjects[0] || null
    return {
      subjects,
      currentSubjectId: currentSubject ? currentSubject.id : null,
      currentSubjectName: currentSubject ? currentSubject.name : '',
      allCategoryTree,
      categories: currentSubject ? (currentSubject.children || []) : []
    }
  },

  buildCategoryTree(list) {
    const map = {}

    const collect = (items) => {
      ;(items || []).forEach(item => {
        if (!map[item.id]) {
          map[item.id] = {
            ...item,
            children: []
          }
        } else {
          map[item.id] = {
            ...map[item.id],
            ...item,
            children: map[item.id].children || []
          }
        }
        if (item.children && item.children.length > 0) {
          collect(item.children)
        }
      })
    }

    collect(list)

    Object.keys(map).forEach(id => {
      map[id].children = []
    })

    const roots = []
    Object.keys(map).forEach(id => {
      const item = map[id]
      if (item.parentId && item.parentId > 0 && map[item.parentId]) {
        map[item.parentId].children.push(item)
      } else {
        roots.push(item)
      }
    })

    const sortByOrder = (items) => {
      items.sort((a, b) => {
        const sortA = a.sort || 0
        const sortB = b.sort || 0
        return sortA === sortB ? a.id - b.id : sortA - sortB
      })
      items.forEach(item => sortByOrder(item.children || []))
    }
    sortByOrder(roots)

    return roots
  },

  // 点击科目切换章/节
  onSubjectTap(e) {
    const subjectId = e.currentTarget.dataset.id
    const subject = this.data.subjects.find(item => item.id == subjectId)
    // 点当前科目不重复渲染
    if (!subject || subject.id == this.data.currentSubjectId) return
    this.setData({
      currentSubjectId: subject.id,
      currentSubjectName: subject.name,
      categories: subject.children || []
    })
  },

  // 加载统计数据
  async loadStats() {
    // 检查登录状态
    const token = wx.getStorageSync('token')
    if (!token) {
      // 未登录，显示默认数据
      this.setData({
        'stats.wrongCount': 0,
        'stats.favoriteCount': 0
      })
      return
    }
    
    // 检查是否已选择题库
    if (!this.data.currentBankId) {
      this.setData({
        'stats.wrongCount': 0,
        'stats.favoriteCount': 0
      })
      return
    }
    
    try {
      // 获取错题数量
      const wrongRes = await api.wrong.getList(this.data.currentBankId)
      const wrongCount = wrongRes.data ? wrongRes.data.length : 0

      // 获取收藏数量
      const favRes = await api.favorite.getList(this.data.currentBankId)
      const favoriteCount = favRes.data ? favRes.data.length : 0

      this.setData({
        'stats.wrongCount': wrongCount,
        'stats.favoriteCount': favoriteCount
      })
    } catch (error) {
      console.error('加载统计数据失败:', error)
      // 出错时显示默认值，不打扰用户
      this.setData({
        'stats.wrongCount': 0,
        'stats.favoriteCount': 0
      })
    }
  },

  // 检查登录状态
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
            // 跳转到个人中心页面登录
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

  // 点击分类开始刷题
  onCategoryTap(e) {
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    const { id, name, parentName } = e.currentTarget.dataset
    const bankName = this.data.currentBankName || ''
    // 点的是「节」时带上所属「章」，拼成完整路径（与错题本的「父 / 子」一致）
    const fullName = parentName && parentName !== name
      ? `${parentName} / ${name}`
      : (name || '')
    wx.navigateTo({
      url: `/pages/practice/practice?categoryId=${id}`
        + `&categoryName=${encodeURIComponent(fullName)}`
        + `&bankId=${this.data.currentBankId}`
        + `&bankName=${encodeURIComponent(bankName)}`
        + `&practiceType=1`
    })
  },

  onParentCategoryTap(e) {
    const { id, name, hasChildren } = e.currentTarget.dataset
    if (hasChildren === true || hasChildren === 'true') {
      return
    }
    this.onCategoryTap({
      currentTarget: {
        dataset: { id, name, parentName: '' }
      }
    })
  },

  // 顺序练习
  onOrderPractice() {
    if (!this.data.currentBankId) {
      wx.showToast({ title: '请先选择题库', icon: 'none' })
      return
    }
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    wx.navigateTo({
      url: `/pages/practice/practice?bankId=${this.data.currentBankId}&practiceType=1`
        + `&title=${encodeURIComponent('顺序练习')}`
        + `&bankName=${encodeURIComponent(this.data.currentBankName || '')}`
    })
  },

  // 随机练习
  onRandomPractice() {
    if (!this.data.currentBankId) {
      wx.showToast({ title: '请先选择题库', icon: 'none' })
      return
    }
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    wx.navigateTo({
      url: `/pages/practice/practice?bankId=${this.data.currentBankId}&practiceType=2`
        + `&title=${encodeURIComponent('随机练习')}`
        + `&bankName=${encodeURIComponent(this.data.currentBankName || '')}`
    })
  },

  // 错题练习
  onWrongPractice() {
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    if (this.data.stats.wrongCount === 0) {
      wx.showToast({ title: '暂无错题', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/wrong/wrong?bankId=${this.data.currentBankId}`
    })
  },

  // 我的收藏
  onFavoriteTap() {
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    wx.navigateTo({
      url: `/pages/favorite/favorite?bankId=${this.data.currentBankId}`
    })
  },

  // 进入教育学背诵模块
  goEduModule() {
    wx.navigateTo({ url: '/pages/edu/index' })
  },

  // 下拉刷新
  async onPullDownRefresh() {
    if (this.data.viewMode === 'bankDetail' && this.data.currentBankId) {
      await this.loadCategories(this.data.currentBankId)
      await this.loadStats()
    } else {
      await this.loadBanks()
    }
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
