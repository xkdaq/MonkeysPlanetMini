// AES解密工具 - 与后端加密配套使用
// 使用 CryptoJS 进行 AES-CBC 解密和 MD5 签名

// 引入 CryptoJS
const CryptoJS = require('./crypto-js.min.js')
// 从配置文件中读取密钥
const { AES_KEY, AES_IV, SIGN_KEY } = require('./config.js')

/**
 * 生成请求签名
 * 签名规则：MD5(SIGN_KEY + timestamp + path)
 * @param {string} path - 请求路径（如 /mp/exam/practice/start）
 * @returns {object} 包含timestamp和sign的对象
 */
function generateSign(path) {
  const timestamp = Date.now().toString()
  const signContent = SIGN_KEY + timestamp + path
  const sign = CryptoJS.MD5(signContent).toString()
  return {
    timestamp: timestamp,
    sign: sign
  }
}

/**
 * AES解密（CBC模式，Pkcs7填充）
 * @param {string} encryptedBase64 - Base64编码的加密数据
 * @returns {object} 解密后的JSON对象
 */
function decryptData(encryptedBase64) {
  try {
    const key = CryptoJS.enc.Utf8.parse(AES_KEY)
    const iv = CryptoJS.enc.Utf8.parse(AES_IV)
    
    const decrypted = CryptoJS.AES.decrypt(encryptedBase64, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    })
    
    const result = decrypted.toString(CryptoJS.enc.Utf8)
    return JSON.parse(result)
  } catch (e) {
    console.error('解密失败:', e)
    return null
  }
}

/**
 * 处理响应数据，如果加密则解密
 * @param {object} responseData - 后端返回的数据
 * @returns {object} 处理后的数据
 */
function processResponse(responseData) {
  if (responseData.encrypted && responseData.data) {
    const decrypted = decryptData(responseData.data)
    if (decrypted !== null) {
      responseData.data = decrypted
      delete responseData.encrypted
    }
  }
  return responseData
}

module.exports = {
  generateSign,
  decryptData,
  processResponse
}