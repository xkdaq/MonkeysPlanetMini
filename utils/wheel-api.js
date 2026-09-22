// utils/wheel-api.js
// 抽题大转盘接口封装
// 后端 /h5/wheel/* 为公开接口（@Anonymous），响应体整体 AES-CBC 加密为 Base64 文本，
// 与文章/资料接口共用同一组 key/iv（AES_KEY + AES_IV_ARTICLE）。
// 这里用 CryptoJS 解密后返回 data，不改动后端。

const CryptoJS = require('./crypto-js.min.js')
const { BASE_URL, AES_KEY, AES_IV_ARTICLE } = require('./config.js')

function decrypt(cipher) {
  const key = CryptoJS.enc.Utf8.parse(AES_KEY)
  const iv = CryptoJS.enc.Utf8.parse(AES_IV_ARTICLE)
  const plain = CryptoJS.AES.decrypt(cipher, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  })
  return plain.toString(CryptoJS.enc.Utf8)
}

function request(path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${path}`,
      method: 'GET',
      data: data || {},
      dataType: 'text',
      timeout: 30000,
      success: (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`请求失败: ${res.statusCode}`))
          return
        }
        const raw = typeof res.data === 'string' ? res.data.trim() : String(res.data || '').trim()
        if (!raw) {
          reject(new Error('返回内容为空'))
          return
        }
        let json = null
        try {
          json = JSON.parse(raw)
        } catch (e) {
          try {
            json = JSON.parse(decrypt(raw))
          } catch (e2) {
            reject(new Error('数据解析失败'))
            return
          }
        }
        if (json.code !== 0 && json.code !== 200) {
          reject(new Error(json.msg || '接口返回异常'))
          return
        }
        resolve(json.data)
      },
      fail: (err) => reject(err)
    })
  })
}

module.exports = {
  // 获取转盘题库列表（含题目数量）
  getBanks: () => request('/h5/wheel/banks'),
  // 获取指定题库的全部题目
  getQuestions: (bankId) => request('/h5/wheel/questions', { bankId })
}
