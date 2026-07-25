/**
 * 网盘资料 API - 使用加密请求方式
 */
const CryptoJS = require('../miniprogram_npm/crypto-js/index.js')

const { BASE_URL, AES_KEY, AES_IV_ARTICLE, API_VERSION } = require('./config.js')

// AES 解密函数
function aesDecrypt(encryptedBase64) {
  try {
    const key = CryptoJS.enc.Utf8.parse(AES_KEY)
    const iv = CryptoJS.enc.Utf8.parse(AES_IV_ARTICLE)
    const decrypted = CryptoJS.AES.decrypt(encryptedBase64, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    })
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8)
    console.log('解密：', decryptedText)
    return JSON.parse(decryptedText)
  } catch (e) {
    console.log('解密失败：', e)
    throw new Error('数据解析失败')
  }
}

function secureRequest(url, data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'x-version': API_VERSION
      },
      data,
      success(res) {
        try {
          const decryptedData = aesDecrypt(res.data)
          resolve(decryptedData)
        } catch (e) {
          wx.showToast({ title: '数据解密失败', icon: 'none' })
          reject(e)
        }
      },
      fail(err) {
        wx.showToast({ title: '网络错误', icon: 'none' })
        reject(err)
      }
    })
  })
}

function normalizeMaterialOption(item) {
  if (typeof item === 'string') {
    return {
      id: item,
      name: item
    }
  }
  return {
    id: item.id,
    name: item.name || item.subjectName || item.categoryName || '',
    subjectId: item.subjectId,
    code: item.code || '',
    sort: item.sort || 0
  }
}

function normalizeListArgs(filter, keywords) {
  if (filter && typeof filter === 'object') {
    return {
      subjectId: filter.subjectId || '',
      categoryId: filter.categoryId || '',
      category: filter.category || '',
      keywords: filter.keywords || keywords || ''
    }
  }
  return {
    subjectId: '',
    categoryId: '',
    category: filter || '',
    keywords: keywords || ''
  }
}

function materialTags(item) {
  if (Array.isArray(item.categoryList) && item.categoryList.length > 0) {
    return item.categoryList
  }
  return [item.subjectName, item.categoryName].filter(Boolean)
}

// 资料列表
function getMaterialList(pageNum, pageSize, filter = '', keywords = '') {
  console.log('请求页码：', pageNum)
  const params = normalizeListArgs(filter, keywords)
  let query = `/api/material/list?pageNum=${pageNum}&pageSize=${pageSize}`
  if (params.subjectId) {
    query += `&subjectId=${encodeURIComponent(params.subjectId)}`
  }
  if (params.categoryId) {
    query += `&categoryId=${encodeURIComponent(params.categoryId)}`
  }
  if (params.category) {
    query += `&category=${encodeURIComponent(params.category)}`
  }
  if (params.keywords) {
    query += `&keywords=${encodeURIComponent(params.keywords)}`
  }
  return secureRequest(query)
    .then((res) => {
      const rawList = res.rows || []
      const formattedList = rawList.map((item) => ({
        title: item.title,
        id: item.id,
        subjectId: item.subjectId,
        categoryId: item.categoryId,
        subjectName: item.subjectName || '',
        categoryName: item.categoryName || '',
        isTop: item.isTop,
        accessType: item.accessType,
        categoryList: materialTags(item),
        coverImage: item.coverImage,
        content: item.content,
        baiduUrl: item.baiduUrl || '',
        quarkUrl: item.quarkUrl || '',
        baiduCode: item.baiduCode || '',
        quarkCode: item.quarkCode || ''
      }))
      return { data: formattedList }
    })
    .catch((err) => {
      console.error('获取资料列表失败', err)
      throw err
    })
}

// 资料科目列表
function getMaterialSubjects() {
  return secureRequest('/api/material/subjects')
    .then((res) => {
      console.log('科目接口原始响应:', res)
      return (res.data || []).map(normalizeMaterialOption).filter(item => item.name)
    })
    .catch((err) => {
      console.error('获取科目列表失败', err)
      return []
    })
}

// 资料分类列表
function getMaterialCategories(subjectId = '') {
  let query = '/api/material/categories'
  if (subjectId) {
    query += `?subjectId=${encodeURIComponent(subjectId)}`
  }
  return secureRequest(query)
    .then((res) => {
      console.log('分类接口原始响应:', res)
      return (res.data || []).map(normalizeMaterialOption).filter(item => item.name)
    })
    .catch((err) => {
      console.error('获取分类列表失败', err)
      return []
    })
}

// 资料详情
function getMaterialDetail(id) {
  return secureRequest(`/api/material/details?id=${id}`)
    .then((res) => {
      if (res && res.data && res.data.title) {
        return {
          title: res.data.title,
          content: res.data.content,
          accessType: res.data.accessType,
          subjectName: res.data.subjectName || '',
          categoryName: res.data.categoryName || '',
          categoryList: materialTags(res.data),
          baiduUrl: res.data.baiduUrl || '',
          quarkUrl: res.data.quarkUrl || '',
          baiduCode: res.data.baiduCode || '',
          quarkCode: res.data.quarkCode || '',
          linkRemark: res.data.linkRemark || ''
        }
      } else {
        wx.showToast({ title: '获取详情失败', icon: 'none' })
        return Promise.reject(new Error('数据格式异常'))
      }
    })
    .catch(err => {
      wx.showToast({ title: '网络错误', icon: 'none' })
      return Promise.reject(err)
    })
}

module.exports = {
  getMaterialList,
  getMaterialSubjects,
  getMaterialCategories,
  getMaterialDetail
}
