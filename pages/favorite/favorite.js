const api = require('../../utils/api.js')

Page({
  data: {
    bankId: null,
    favorites: [],
    categories: [], // 按分类分组的收藏
    grouped: false, // 是否按分类展示
    loading: false,
    expandedCategories: [] // 展开的分类索引
  },

  onLoad(options) {
    this.setData({
      bankId: options.bankId ? parseInt(options.bankId) : null
    })
  },

  onShow() {
    this.loadFavorites()
  },

  // 加载收藏列表
  async loadFavorites() {
    this.setData({ loading: true })
    
    try {
      // 构建请求参数
      const params = {
        groupByCategory: 1
      }
      // 只有当 bankId 有效时才添加
      if (this.data.bankId) {
        params.bankId = this.data.bankId
      }
      
      console.log('[DEBUG] 请求收藏列表参数:', params)
      
      // 请求按分类分组的数据
      const res = await api.favorite.getList(params.bankId, params.groupByCategory)
      
      console.log('[DEBUG] 收藏列表返回数据:', res.data)
      
      // 检查返回数据是否是分组格式
      if (res.data && res.data.grouped === true) {
        // 按分类分组的数据
        const categories = res.data.categories || []
        // 默认全部收起
        const expandedCategories = []
        
        this.setData({
          categories,
          grouped: true,
          loading: false,
          expandedCategories
        })
      } else if (Array.isArray(res.data)) {
        // 平铺列表（兼容旧格式或后端不支持分组）
        console.log('[DEBUG] 返回平铺列表格式，手动分组')
        const favorites = res.data
        // 手动按分类分组
        const categoryMap = {}
        favorites.forEach(fav => {
          const categoryId = fav.question?.categoryId || 0
          const categoryName = fav.question?.categoryName || '未分类'
          
          if (!categoryMap[categoryId]) {
            categoryMap[categoryId] = {
              categoryId,
              categoryName,
              count: 0,
              favorites: []
            }
          }
          categoryMap[categoryId].favorites.push(fav)
          categoryMap[categoryId].count++
        })
        
        const categories = Object.values(categoryMap)
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
          expandedCategories
        })
      } else {
        // 空数据或其他格式
        this.setData({
          categories: [],
          grouped: true,
          loading: false,
          expandedCategories: []
        })
      }
    } catch (error) {
      console.error('加载收藏失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
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

  // 点击收藏题目
  onFavoriteTap(e) {
    const { categoryIndex, favIndex } = e.currentTarget.dataset
    
    if (this.data.grouped) {
      // 按分类模式：获取该分类下的所有收藏
      const category = this.data.categories[categoryIndex]
      const favorites = category.favorites || []
      const questionIds = favorites.map(f => f.questionId).join(',')
      
      wx.navigateTo({
        url: `/pages/practice/practice?favoriteMode=1&questionIds=${questionIds}&currentIndex=${favIndex}&title=收藏练习`
      })
    } else {
      // 平铺模式
      const { index } = e.currentTarget.dataset
      const questionIds = this.data.favorites.map(f => f.questionId).join(',')
      
      wx.navigateTo({
        url: `/pages/practice/practice?favoriteMode=1&questionIds=${questionIds}&currentIndex=${index}&title=收藏练习`
      })
    }
  },

  // 取消收藏
  async onCancelTap(e) {
    e.stopPropagation()
    
    const { id, categoryIndex, favIndex } = e.currentTarget.dataset
    
    try {
      await api.favorite.toggle(id)
      
      if (this.data.grouped) {
        // 按分类模式：从对应分类中移除
        const categories = this.data.categories
        const category = categories[categoryIndex]
        category.favorites.splice(favIndex, 1)
        category.count = category.favorites.length
        
        // 如果该分类下没有收藏了，移除该分类
        const newCategories = categories.filter(c => c.favorites.length > 0)
        
        this.setData({ categories: newCategories })
      } else {
        // 平铺模式
        const favorites = this.data.favorites
        favorites.splice(favIndex, 1)
        this.setData({ favorites })
      }
      
      wx.showToast({ title: '已取消收藏', icon: 'success' })
    } catch (error) {
      console.error('取消收藏失败:', error)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 开始收藏练习
  startPractice() {
    let allFavorites = []
    
    if (this.data.grouped) {
      // 按分类模式：收集所有分类下的收藏
      this.data.categories.forEach(cat => {
        allFavorites = allFavorites.concat(cat.favorites || [])
      })
    } else {
      // 平铺模式
      allFavorites = this.data.favorites
    }
    
    if (allFavorites.length === 0) {
      wx.showToast({ title: '暂无收藏题目', icon: 'none' })
      return
    }
    
    const questionIds = allFavorites.map(f => f.questionId).join(',')
    
    wx.navigateTo({
      url: `/pages/practice/practice?favoriteMode=1&questionIds=${questionIds}&title=收藏练习`
    })
  },

  // 开始某个分类的收藏练习
  startCategoryPractice(e) {
    const { index } = e.currentTarget.dataset
    const category = this.data.categories[index]
    const favorites = category.favorites || []
    
    if (favorites.length === 0) {
      wx.showToast({ title: '该分类暂无收藏', icon: 'none' })
      return
    }
    
    const questionIds = favorites.map(f => f.questionId).join(',')
    
    wx.navigateTo({
      url: `/pages/practice/practice?favoriteMode=1&questionIds=${questionIds}&title=${category.categoryName}`
    })
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadFavorites()
    wx.stopPullDownRefresh()
  }
})
