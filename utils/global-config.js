/**
 * 全局配置（后台总开关）
 *
 * 约定接口：POST /api/common/config
 * 响应支持两种格式：
 *   1. 明文 JSON：{ "code": 200, "data": { "adEnabled": true } }
 *   2. 与其他接口一致的 AES 加密字符串（解密后为上述 JSON）
 *
 * 字段说明：
 *   adEnabled: true  = 资料/文章需要看广告才能查看
 *              false = 所有资料直接查看（不看广告）
 *
 * 兜底策略：接口异常、字段缺失时一律按 false 处理（直接放行，不看广告）
 */
const CryptoJS = require('../miniprogram_npm/crypto-js/index.js')
const { BASE_URL, AES_KEY, AES_IV_ARTICLE, API_VERSION } = require('./config.js')

const STORAGE_KEY = 'global_config'

// 默认配置：不看广告、非审核模式
const DEFAULT_CONFIG = {
  adEnabled: false,
  reviewMode: false
}

function tryDecrypt(payload) {
  try {
    const key = CryptoJS.enc.Utf8.parse(AES_KEY)
    const iv = CryptoJS.enc.Utf8.parse(AES_IV_ARTICLE)
    const decrypted = CryptoJS.AES.decrypt(payload, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    })
    const text = decrypted.toString(CryptoJS.enc.Utf8)
    return JSON.parse(text)
  } catch (e) {
    return null
  }
}

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG }
  const data = raw.data && typeof raw.data === 'object' ? raw.data : raw
  return {
    adEnabled: data.adEnabled === true || data.adEnabled === 1,
    reviewMode: data.reviewMode === true || data.reviewMode === 1
  }
}

/**
 * 拉取全局配置并缓存到本地
 * 任何异常都静默兜底为默认配置，不阻塞小程序启动
 */
function fetchGlobalConfig() {
  return new Promise((resolve) => {
    wx.request({
      url: `${BASE_URL}/api/common/config`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'x-version': API_VERSION
      },
      data: {},
      success(res) {
        let raw = res.data
        // 字符串响应按 AES 加密数据处理
        if (typeof raw === 'string') {
          raw = tryDecrypt(raw)
        }
        const config = normalizeConfig(raw)
        wx.setStorageSync(STORAGE_KEY, config)
        console.log('全局配置已更新:', config)
        resolve(config)
      },
      fail(err) {
        console.warn('拉取全局配置失败，使用默认配置:', err)
        resolve(getCachedConfig())
      }
    })
  })
}

// 读取本地缓存的配置
function getCachedConfig() {
  const cached = wx.getStorageSync(STORAGE_KEY)
  if (cached && typeof cached === 'object') {
    return normalizeConfig(cached)
  }
  return { ...DEFAULT_CONFIG }
}

/**
 * 是否需要看广告
 * true = 看广告；false = 直接查看
 */
function isAdEnabled() {
  return getCachedConfig().adEnabled === true
}

/**
 * 是否处于审核模式
 * true = 审核中，隐藏网盘链接、手机号绑定等敏感功能
 */
function isReviewMode() {
  return getCachedConfig().reviewMode === true
}

module.exports = {
  fetchGlobalConfig,
  getCachedConfig,
  isAdEnabled,
  isReviewMode
}
