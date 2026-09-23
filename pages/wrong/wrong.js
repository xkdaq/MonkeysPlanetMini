const api = require('../../utils/api.js')

Page({
  data: {
    bankId: null,
    wrongs: [],
    categories: [], // 按分类分组的错题
    grouped: false, // 是否按分类展示
    loading: false,
    expandedCategories: [], // 展开的分类索引
    categoryNameMap: {}, // 分类ID到完整章节路径的映射
    totalCount: 0 // 错题总数
  },

  onLoad(options) {
    this.setData({
      bankId: options.bankId ? parseInt(options.bankId) : null
    })
    this.loadWrongs()
  },

  onShow() {
    this.loadWrongs()
  },

  // 加载错题列表
  async loadWrongs() {
    this.setData({ loading: true })
    
    try {
      await this.ensureCategoryNameMap()

      // 构建请求参数
      const params = {
        groupByCategory: 1
      }
      // 只有当 bankId 有效时才添加
      if (this.data.bankId) {
        params.bankId = this.data.bankId
      }
      
      console.log('[DEBUG] 请求错题列表参数:', params)
      
      // 请求按分类分组的数据
      const res = await api.wrong.getList(params.bankId, params.groupByCategory)
      
      console.log('[DEBUG] 错题列表返回数据:', res.data)
      
        // 检查返回数据是否是分组格式
      if (res.data && res.data.grouped === true) {
        // 按分类分组的数据
        const categories = this.normalizeCategories(res.data.categories || [])
        // 默认全部收起
        const expandedCategories = []
        
        this.setData({
          categories,
          grouped: true,
          loading: false,
          expandedCategories,
          totalCount: categories.reduce((n, c) => n + (c.count || 0), 0)
        })
      } else if (Array.isArray(res.data)) {
        // 平铺列表（兼容旧格式或后端不支持分组）
        console.log('[DEBUG] 返回平铺列表格式，手动分组')
        const wrongs = res.data
        // 手动按分类分组
        const categoryMap = {}
        wrongs.forEach(wrong => {
          const categoryId = wrong.question?.categoryId || 0
          const categoryName = this.getWrongCategoryName(wrong)
          
          if (!categoryMap[categoryId]) {
            categoryMap[categoryId] = {
              categoryId,
              categoryName,
              count: 0,
              wrongs: []
            }
          }
          categoryMap[categoryId].wrongs.push(wrong)
          categoryMap[categoryId].count++
        })
        
        const categories = this.normalizeCategories(Object.values(categoryMap))
        // 按分类名称排序
        categories.sort((a, b) => {
          if (a.categoryName === '未分类') return 1
          if (b.categoryName === '未分类') return -1
          return a.categoryName.localeCompare(b.categoryName)
        })
        
        // 默认全部收起
        const expandedCategories = []
        
        this.setData({
          categories,
          grouped: true,
          loading: false,
          expandedCategories,
          totalCount: categories.reduce((n, c) => n + (c.count || 0), 0)
        })
      } else {
        // 空数据或其他格式
        this.setData({
          categories: [],
          grouped: true,
          loading: false,
          expandedCategories: [],
          totalCount: 0
        })
      }
    } catch (error) {
      console.error('加载错题失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 加载分类树，生成“章 / 节”的完整路径
  async ensureCategoryNameMap() {
    if (Object.keys(this.data.categoryNameMap).length > 0) {
      return this.data.categoryNameMap
    }

    try {
      const res = await api.exam.getCategoryTree(this.data.bankId)
      const categories = this.flattenCategories(res.data || [])
      const categoryById = {}
      const categoryNameMap = {}

      categories.forEach(category => {
        categoryById[category.id] = category
      })

      categories.forEach(category => {
        const parent = category.parentId ? categoryById[category.parentId] : null
        categoryNameMap[category.id] = parent ? `${parent.name} / ${category.name}` : category.name
      })

      this.setData({ categoryNameMap })
      return categoryNameMap
    } catch (error) {
      console.error('加载分类树失败:', error)
      return {}
    }
  },

  flattenCategories(categories) {
    return categories.reduce((list, category) => {
      const children = category.children || []
      return list.concat(category, this.flattenCategories(children))
    }, [])
  },

  // 统一补齐分类展示名，优先使用分类树拼出的完整路径（如：2025年 / 多选题）
  normalizeCategories(categories) {
    return categories.map(category => {
      const wrongs = category.wrongs || []
      const firstWrong = wrongs[0]
      const categoryId = category.categoryId || firstWrong?.question?.categoryId || 0
      const fallbackName = this.getWrongCategoryName(firstWrong) || category.categoryName || '未分类'
      const categoryName = this.getCategoryDisplayName(categoryId, fallbackName)
      return {
        ...category,
        categoryId,
        categoryName,
        count: category.count || wrongs.length,
        wrongs
      }
    })
  },

  getCategoryDisplayName(categoryId, fallbackName) {
    if (categoryId && this.data.categoryNameMap[categoryId]) {
      return this.data.categoryNameMap[categoryId]
    }
    return fallbackName || '未分类'
  },

  getWrongCategoryName(wrong) {
    if (!wrong || !wrong.question) {
      return ''
    }
    return wrong.question.categoryName || wrong.categoryName || '未分类'
  },

  // 切换分类展开/收起
  toggleCategory(e) {
    const index = e.currentTarget.dataset.index
    const expandedCategories = this.data.expandedCategories
    const pos = expandedCategories.indexOf(index)
    
    if (pos > -1) {
      expandedCategories.splice(pos, 1)
    } else {
      expandedCategories.push(index)
    }
    
    this.setData({ expandedCategories: [...expandedCategories] })
  },

  // 点击错题进入练习
  onWrongTap(e) {
    const { categoryIndex, wrongIndex } = e.currentTarget.dataset
    
    if (this.data.grouped) {
      const category = this.data.categories[categoryIndex]
      const wrongs = category.wrongs || []
      const questionIds = wrongs.map(w => w.questionId).join(',')

      wx.navigateTo({
        url: `/pages/practice/practice?wrongMode=1&questionIds=${questionIds}&currentIndex=${wrongIndex}&title=错题练习`
      })
    } else {
      const { index } = e.currentTarget.dataset
      const questionIds = this.data.wrongs.map(w => w.questionId).join(',')

      wx.navigateTo({
        url: `/pages/practice/practice?wrongMode=1&questionIds=${questionIds}&currentIndex=${index}&title=错题练习`
      })
    }
  },

  // 开始某个分类的错题练习
  startCategoryPractice(e) {
    const { index } = e.currentTarget.dataset
    const category = this.data.categories[index]
    const wrongs = category.wrongs || []
    
    if (wrongs.length === 0) {
      wx.showToast({ title: '该分类暂无错题', icon: 'none' })
      return
    }
    
    const questionIds = wrongs.map(w => w.questionId).join(',')
    
    wx.navigateTo({
      url: `/pages/practice/practice?wrongMode=1&questionIds=${questionIds}&title=${category.categoryName}`
    })
  },

  // 全部练习：把所有章节的错题合并成一次专项练习
  startAllPractice() {
    const { grouped, categories, wrongs } = this.data
    const all = grouped
      ? categories.reduce((acc, c) => acc.concat(c.wrongs || []), [])
      : wrongs
    if (!all.length) {
      wx.showToast({ title: '暂无错题', icon: 'none' })
      return
    }
    const questionIds = all.map(w => w.questionId).join(',')
    wx.navigateTo({
      url: `/pages/practice/practice?wrongMode=1&questionIds=${questionIds}&title=${encodeURIComponent('错题练习')}`
    })
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadWrongs()
    wx.stopPullDownRefresh()
  }
})
