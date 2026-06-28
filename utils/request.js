// 基础配置 - 从配置文件中读取后端地址
const { BASE_URL } = require('./config.js')

// 引入加密工具
const { processResponse, generateSign } = require('./crypto.js')

// 清除登录状态的辅助函数
const clearLoginState = () => {
  wx.removeStorageSync('token')
  wx.removeStorageSync('userInfo')
}

// 请求拦截器
const request = (options) => {
  return new Promise((resolve, reject) => {
    // 显示加载中
    if (options.loading !== false) {
      wx.showLoading({
        title: options.loadingText || '加载中...',
        mask: true
      })
    }

    // 获取token
    const token = wx.getStorageSync('token')
    
    // 生成请求签名（用于加密接口验证）
    const signData = generateSign(options.url)

    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Timestamp': signData.timestamp,
        'X-Sign': signData.sign,
        ...options.header
      },
      timeout: options.timeout || 30000,
      success: (res) => {
        // 隐藏加载中
        if (options.loading !== false) {
          wx.hideLoading()
        }

        if (res.statusCode === 200) {
          let data = res.data
          
          // 处理加密响应（如果encrypted为true，解密data字段）
          if (data.encrypted && data.data) {
            data = processResponse(data)
          }
          
          // 后端返回code为0表示成功
          if (data.code === 0) {
            resolve(data)
          } else if (data.code === 401 || (data.msg && data.msg.includes('登录已过期'))) {
            // token过期或登录已过期，清除登录状态并提示用户
            clearLoginState()
            wx.showModal({
              title: '提示',
              content: '登录已过期，请重新登录',
              showCancel: false,
              confirmText: '确定',
              success: () => {
                // 可以在这里跳转到登录页或执行其他操作
              }
            })
            reject(data)
          } else {
            // 其他错误
            wx.showToast({
              title: data.msg || '请求失败',
              icon: 'none'
            })
            reject(data)
          }
        } else if (res.statusCode === 401) {
          // token过期
          clearLoginState()
          wx.showToast({
            title: '登录已过期',
            icon: 'none'
          })
          reject(res)
        } else {
          wx.showToast({
            title: `请求失败: ${res.statusCode}`,
            icon: 'none'
          })
          reject(res)
        }
      },
      fail: (err) => {
        // 隐藏加载中
        if (options.loading !== false) {
          wx.hideLoading()
        }
        
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

// GET请求
const get = (url, data = {}, options = {}) => {
  // 过滤掉 undefined 和 null 的参数
  const filteredData = {}
  for (const key in data) {
    if (data[key] !== undefined && data[key] !== null) {
      filteredData[key] = data[key]
    }
  }
  
  return request({
    url,
    method: 'GET',
    data: filteredData,
    ...options
  })
}

// POST请求
const post = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'POST',
    data,
    ...options
  })
}

// PUT请求
const put = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'PUT',
    data,
    ...options
  })
}

// DELETE请求
const del = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'DELETE',
    data,
    ...options
  })
}

// 上传文件
const upload = (url, filePath, name = 'file', formData = {}) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    
    wx.uploadFile({
      url: `${BASE_URL}${url}`,
      filePath,
      name,
      formData,
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          const data = JSON.parse(res.data)
          if (data.code === 0) {
            resolve(data)
          } else {
            wx.showToast({
              title: data.msg || '上传失败',
              icon: 'none'
            })
            reject(data)
          }
        } else {
          reject(res)
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

module.exports = {
  request,
  get,
  post,
  put,
  delete: del,
  upload,
  BASE_URL
}
