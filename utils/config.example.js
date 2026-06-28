// ========== 核心接口配置模板 ==========
// 将此文件复制为 config.js 并填入实际的密钥值
// cp utils/config.example.js utils/config.js

// 后端API基础地址
const BASE_URL = 'https://api.monkeysxu.top'

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
  AES_KEY,
  AES_IV,
  AES_IV_ARTICLE,
  SIGN_KEY
}
