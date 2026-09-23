// pages/exam/bank.js
// 题库详情（二级页）：从「题库」tab 的题库列表 navigateTo 进入。
// 原先这套界面挤在 tab 页里靠 viewMode 切换，没有原生返回、tabBar 还在，
// 系统返回手势会直接退出小程序，所以拆成独立页面。
const api = require('../../utils/api.js')

Page({
  data: {
    bankId: null,
    bankName: '',
    bankDesc: '',
    isEntry: false,
    subjects: [],
    currentSubjectId: null,
    currentSubjectName: '',
    allCategoryTree: [],
    categories: [],
    loading: false
  },

  onLoad(options) {
    const bankId = options.bankId ? parseInt(options.bankId) : null
    const bankName = this.safeDecode(options.bankName)
    const bankDesc = this.safeDecode(options.bankDesc)

    // 从分享卡片 / 朋友圈单页模式进来时，页面栈里只有本页，
    // 系统只给「返回首页」（会去到 pages 数组首页，不是题库 tab），
    // 所以这种情况下自己给一个回题库列表的入口。
    const isEntry = typeof getCurrentPages === 'function' && getCurrentPages().length <= 1

    this.setData({ bankId, bankName, bankDesc, isEntry, loading: true })
    wx.setNavigationBarTitle({ title: bankName || '题库' })

    if (!bankId) {
      this.setData({ loading: false })
      wx.showToast({ title: '题库参数缺失', icon: 'none' })
      return
    }
    this.loadCategories(bankId)
  },

  // 小程序不会自动 decode query，这里统一兜一层
  safeDecode(v) {
    if (!v || typeof v !== 'string') return ''
    if (v.indexOf('%') === -1) return v
    try { return decodeURIComponent(v) } catch (e) { return v }
  },

  async loadCategories(bankId) {
    try {
      const res = await api.exam.getCategoryTree(bankId)
      const result = this.processCategories(res.data || [])
      this.setData({
        subjects: result.subjects,
        currentSubjectId: result.currentSubjectId,
        currentSubjectName: result.currentSubjectName,
        allCategoryTree: result.allCategoryTree,
        categories: result.categories,
        loading: false
      })
    } catch (error) {
      console.error('加载分类失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '分类加载失败', icon: 'none' })
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
            // switchTab 会销毁所有非 tabBar 页面，也就是本页。
            // 先把当前题库记下来，登录后由题库 tab 页自动跳回来，
            // 否则用户登录完只能看到题库列表，得重新点一次。
            try {
              wx.setStorageSync('pendingBank', {
                bankId: this.data.bankId,
                bankName: this.data.bankName,
                bankDesc: this.data.bankDesc
              })
            } catch (e) { /* 存不下就算了，只是少一次自动回跳 */ }
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

  // 练习跳转统一出口：带上题库名，供「继续上次练习」展示
  gotoPractice(params) {
    // 兜底：正常情况下 bankId 缺失时快捷入口就不渲染，这里防的是异常调用路径
    if (!this.data.bankId) {
      wx.showToast({ title: '题库参数缺失', icon: 'none' })
      return
    }
    const parts = [`bankId=${this.data.bankId}`, `bankName=${encodeURIComponent(this.data.bankName || '')}`]
    Object.keys(params).forEach((k) => {
      parts.push(`${k}=${params[k]}`)
    })
    wx.navigateTo({ url: `/pages/practice/practice?${parts.join('&')}` })
  },

  // 点击分类开始刷题
  onCategoryTap(e) {
    if (!this.checkLogin()) return
    const { id, name, parentName } = e.currentTarget.dataset
    // 点的是「节」时带上所属「章」，拼成完整路径（与错题本的「父 / 子」一致）
    const fullName = parentName && parentName !== name
      ? `${parentName} / ${name}`
      : (name || '')
    this.gotoPractice({
      categoryId: id,
      categoryName: encodeURIComponent(fullName),
      practiceType: 1
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
    if (!this.checkLogin()) return
    this.gotoPractice({ practiceType: 1, title: encodeURIComponent('顺序练习') })
  },

  // 随机练习
  onRandomPractice() {
    if (!this.checkLogin()) return
    this.gotoPractice({ practiceType: 2, title: encodeURIComponent('随机练习') })
  },

  // 错题练习
  onWrongPractice() {
    if (!this.checkLogin()) return
    if (!this.data.bankId) {
      wx.showToast({ title: '题库参数缺失', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/wrong/wrong?bankId=${this.data.bankId}` })
  },

  // 我的收藏
  onFavoriteTap() {
    if (!this.checkLogin()) return
    if (!this.data.bankId) {
      wx.showToast({ title: '题库参数缺失', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/favorite/favorite?bankId=${this.data.bankId}` })
  },

  // 单页模式下回题库 tab（正常进入时不显示这个入口，用系统返回即可）
  backToBankList() {
    wx.switchTab({ url: '/pages/exam/exam' })
  },

  async onPullDownRefresh() {
    if (this.data.bankId) {
      await this.loadCategories(this.data.bankId)
    }
    wx.stopPullDownRefresh()
  },

  /**
   * 分享好友
   */
  onShareAppMessage() {
    return {
      title: this.data.bankName || '猴哥星球',
      path: `/pages/exam/bank?bankId=${this.data.bankId}&bankName=${encodeURIComponent(this.data.bankName || '')}`
    }
  },

  /**
   * 分享朋友圈
   */
  onShareTimeline() {
    return {
      title: this.data.bankName || '猴哥星球',
      query: `bankId=${this.data.bankId}&bankName=${encodeURIComponent(this.data.bankName || '')}`
    }
  }
})
