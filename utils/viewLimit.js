// 查看次数限制工具
const VIEW_LIMIT_KEY = 'view_limit'
const VIEW_COUNT_KEY = 'view_count'
const MAX_VIEWS_PER_DAY = 10

// 获取今天的日期字符串
function getTodayString() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 检查今天是否可以查看
function canViewToday() {
  const today = getTodayString()
  const savedDate = wx.getStorageSync(VIEW_LIMIT_KEY)
  
  if (savedDate !== today) {
    // 新的一天，重置计数
    wx.setStorageSync(VIEW_LIMIT_KEY, today)
    wx.setStorageSync(VIEW_COUNT_KEY, 0)
    return true
  }
  
  const count = wx.getStorageSync(VIEW_COUNT_KEY) || 0
  return count < MAX_VIEWS_PER_DAY
}

// 记录一次查看
function recordView() {
  const today = getTodayString()
  const savedDate = wx.getStorageSync(VIEW_LIMIT_KEY)
  
  if (savedDate !== today) {
    wx.setStorageSync(VIEW_LIMIT_KEY, today)
    wx.setStorageSync(VIEW_COUNT_KEY, 1)
  } else {
    const count = wx.getStorageSync(VIEW_COUNT_KEY) || 0
    wx.setStorageSync(VIEW_COUNT_KEY, count + 1)
  }
}

// 获取今日剩余查看次数
function getRemainingViews() {
  const today = getTodayString()
  const savedDate = wx.getStorageSync(VIEW_LIMIT_KEY)
  
  if (savedDate !== today) {
    return MAX_VIEWS_PER_DAY
  }
  
  const count = wx.getStorageSync(VIEW_COUNT_KEY) || 0
  return Math.max(0, MAX_VIEWS_PER_DAY - count)
}

module.exports = {
  canViewToday,
  recordView,
  getRemainingViews,
  MAX_VIEWS_PER_DAY
}
