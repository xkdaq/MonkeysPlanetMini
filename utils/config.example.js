// ========== 核心接口配置模板 ==========
// 将此文件复制为 config.js 并填入实际的密钥值
// cp utils/config.example.js utils/config.js

// 后端API基础地址
const BASE_URL = 'https://api.monkeysxu.top'

// 小程序版本号（作为 x-version 请求头，用于后端审核模式判断等版本控制）
const API_VERSION = '10'

// AES密钥（所有接口通用）
const AES_KEY = ''

// AES初始向量（用于 request.js / crypto.js 相关接口：考试、练习、用户等）
const AES_IV = ''

// AES初始向量（用于 article-api.js / material-api.js 相关接口：文章、网盘资料、首页等）
const AES_IV_ARTICLE = ''

// 签名密钥（与后端保持一致）
const SIGN_KEY = ''

module.exports = {
  BASE_URL,
  API_VERSION,
  AES_KEY,
  AES_IV,
  AES_IV_ARTICLE,
  SIGN_KEY
}
