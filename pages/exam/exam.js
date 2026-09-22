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
    // 每次显示页面时刷新统计数据
    const token = wx.getStorageSync('token')
    const bankId = this.data.currentBankId
    if (this.data.viewMode === 'bankDetail' && token && bankId) {
      this.loadStats()
    }
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
    if (!subject) return
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
    const { id, name } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/practice/practice?categoryId=${id}&categoryName=${name}&bankId=${this.data.currentBankId}&practiceType=1`
    })
  },

  onParentCategoryTap(e) {
    const { id, name, hasChildren } = e.currentTarget.dataset
    if (hasChildren === true || hasChildren === 'true') {
      return
    }
    this.onCategoryTap({
      currentTarget: {
        dataset: { id, name }
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
      url: `/pages/practice/practice?bankId=${this.data.currentBankId}&practiceType=1&title=顺序练习`
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
      url: `/pages/practice/practice?bankId=${this.data.currentBankId}&practiceType=2&title=随机练习`
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
