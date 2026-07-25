/**
 * 文章/网盘 API - 使用原来的加密请求方式
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

// 统一请求函数
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

// 文章列表
function getListData(pageNum, pageSize, keywords = '') {
  console.log('请求页码：', pageNum)
  let query = `/api/article/list?pageNum=${pageNum}&pageSize=${pageSize}`
  if (keywords) {
    query += `&keywords=${encodeURIComponent(keywords)}`
  }
  return secureRequest(query)
    .then((res) => {
      const rawList = res.rows || []
      const formattedList = rawList.map((item) => ({
        title: item.title,
        date: item.date,
        id: item.id,
        isTop: item.isTop,
        type: item.type,
        content: item.content
      }))
      return { data: formattedList }
    })
    .catch((err) => {
      console.error('获取文章列表失败', err)
      throw err
    })
}

// 文章详情
function getArticleDetail(id) {
  return secureRequest(`/api/article/details?id=${id}`)
    .then((res) => {
      if (res && res.data.title && res.data.content) {
        return {
          title: res.data.title,
          content: res.data.content
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

// 搜索页面文章列表
function getSearchList(pageNum, pageSize, keywords = '', from = '') {
  let query = `/api/article/list?pageNum=${pageNum}&pageSize=${pageSize}&keywords=${encodeURIComponent(keywords)}`
  query += '&typeList=0,1,2,3,4,5'
  return secureRequest(query)
    .then((res) => {
      const rawList = res.rows || []
      const formattedList = rawList.map((item) => ({
        title: item.title,
        date: item.date,
        id: item.id,
        isTop: item.isTop,
        type: item.type,
        categoryList: item.categoryList,
        content: item.content
      }))
      return { data: formattedList }
    })
    .catch((err) => {
      wx.showToast({ title: '加载失败', icon: 'none' })
      return Promise.reject(err)
    })
}

// 网盘列表
function getWangpanData(pageNum, pageSize) {
  console.log('请求页码：', pageNum)
  return secureRequest(`/api/article/list?pageNum=${pageNum}&pageSize=${pageSize}&typeList=4,5`)
    .then((res) => {
      const rawList = res.rows || []
      const formattedList = rawList.map((item) => ({
        title: item.title,
        date: item.date,
        id: item.id,
        isTop: item.isTop,
        type: item.type,
        content: item.content,
        categoryList: item.categoryList
      }))
      return { data: formattedList }
    })
    .catch((err) => {
      console.error('获取网盘列表失败', err)
      throw err
    })
}

// 首页数据
function getHomeIndexData(bannerLimit = 3, noticeLimit = 3, articleLimit = 5, panArticleLimit = 5) {
  const query = `/api/home/index?bannerLimit=${bannerLimit}&noticeLimit=${noticeLimit}&articleLimit=${articleLimit}&panArticleLimit=${panArticleLimit}`
  return secureRequest(query)
    .then((res) => {
      if (res && res.data) {
        return {
          bannerList: (res.data.bannerList || []).map((item) => ({
            id: item.id,
            title: item.title,
            imageUrl: item.imageUrl,
            linkUrl: item.linkUrl
          })),
          noticeList: (res.data.noticeList || []).map((item) => ({
            id: item.id,
            title: item.title,
            content: item.content
          })),
          articleList: (res.data.articleList || []).map((item) => ({
            id: item.id,
            title: item.title,
            date: item.date,
            isTop: item.isTop,
            type: item.type,
            content: item.content
          })),
          panArticleList: (res.data.panArticleList || []).map((item) => ({
            id: item.id,
            title: item.title,
            isTop: item.isTop,
            accessType: item.accessType,
            content: item.content,
            categoryList: item.categoryList || []
          }))
        }
      }
      throw new Error('获取首页数据失败')
    })
    .catch((err) => {
      console.error('获取首页数据失败', err)
      throw err
    })
}

module.exports = {
  getListData,
  getArticleDetail,
  getSearchList,
  getWangpanData,
  getHomeIndexData
}
