/**
 * API接口统一管理
 */
const { get, post, put } = require('./request.js')

module.exports = {
  // ========== 用户模块 ==========
  user: {
    // 微信登录
    wxLogin: (code) => post('/mp/auth/login', { code }),
    
    // 手机号登录
    phoneLogin: (phone, password) => post('/mp/auth/login/phone', { phone, password }),
    
    // 获取用户信息
    getUserInfo: () => get('/mp/user/info'),
    
    // 更新用户信息（昵称、头像）
    updateUserInfo: (data) => put('/mp/user/info', data),
    
    // 更新头像
    updateAvatar: (avatarUrl) => put('/mp/user/avatar', { avatarUrl }),
    
    // 更新昵称
    updateNickname: (nickname) => put('/mp/user/nickname', { nickname }),
    
    // 更新性别
    updateGender: (gender) => put('/mp/user/gender', { gender }),
    
    // 绑定手机号
    bindPhone: (data) => post('/mp/auth/phone/bind', data),
    
    // 设置密码
    setPassword: (data) => post('/mp/auth/password', data)
  },

  // ========== 题库模块 ==========
  exam: {
    // 获取题库列表
    getBanks: () => get('/mp/exam/banks'),
    
    // 获取分类树
    getCategoryTree: (bankId) => get('/mp/exam/category/tree', { bankId }),
    
    // 获取题目列表
    getQuestions: (params) => get('/mp/exam/questions', params),
    
    // 获取题目详情
    getQuestionDetail: (id) => get(`/mp/exam/question/${id}`),
    
    // 提交题目反馈
    reportQuestion: (data) => post('/mp/exam/question/report', data)
  },

  // ========== 刷题模块 ==========
  practice: {
    // 开始刷题
    start: (params) => get('/mp/exam/practice/start', params),
    
    // 提交答案
    submit: (data) => post('/mp/exam/practice/submit', data),
    
    // 保存刷题记录
    saveRecord: (data) => post('/mp/exam/practice/record', data),
    
    // 获取学习记录列表
    getRecords: (pageNum = 1, pageSize = 10) => get('/mp/exam/practice/records', { pageNum, pageSize })
  },

  // ========== 收藏模块 ==========
  favorite: {
    // 收藏/取消收藏
    toggle: (questionId) => post('/mp/exam/favorite', { questionId }),
    
    // 检查是否已收藏
    check: (questionId) => get('/mp/exam/favorite/check', { questionId }),
    
    // 获取收藏列表
    // bankId: 题库ID（可选）
    // groupByCategory: 是否按分类分组 1-是 0-否
    getList: (bankId, groupByCategory = 0) => get('/mp/exam/favorites', { bankId, groupByCategory })
  },

  // ========== 错题本模块 ==========
  wrong: {
    // 获取错题列表
    // bankId: 题库ID（可选）
    // groupByCategory: 是否按分类分组 1-是 0-否
    getList: (bankId, groupByCategory = 0) => get('/mp/exam/wrongs', { bankId, groupByCategory }),
    
    // 移除错题
    remove: (questionId) => post('/mp/exam/wrongs/remove', { questionId })
  },

  // ========== 问题反馈模块 ==========
  feedback: {
    // 提交反馈
    submit: (data) => post('/mp/feedback/submit', data)
  }
}
