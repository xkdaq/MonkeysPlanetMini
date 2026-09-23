// utils/legal.js
// 法务文档入口。
//
// 原先走 web-view 打开 https://www.monkeysxu.top/*.html，但 web-view 只能加载
// 小程序后台配置过的「业务域名」。开发版/体验版可以在开发者工具里勾「不校验合法域名」
// 绕过，正式版没有这个豁免——域名没进白名单，线上用户点开就是空白/报错，
// 看不到用户协议和隐私政策，既是体验问题也是合规风险。
// 现在统一走本地页 pages/legal/legal，不依赖任何域名配置，离线也能看。
//
// 如果以后把 www.monkeysxu.top 配进了后台「开发管理 → 开发设置 → 业务域名」，
// 想切回线上版本，把 openLegalPage 改回 navigateTo webview 即可，
// LEGAL_PAGES 里的 url 一直保留着。

const LEGAL_PAGES = {
  agreement: {
    title: '用户服务协议',
    url: 'https://www.monkeysxu.top/agreement.html'
  },
  privacy: {
    title: '隐私政策',
    url: 'https://www.monkeysxu.top/privacy.html'
  }
}

/**
 * 打开法务文档
 * @param {'agreement'|'privacy'} type
 */
function openLegalPage(type) {
  if (!LEGAL_PAGES[type]) {
    return
  }
  wx.navigateTo({
    url: `/pages/legal/legal?type=${type}`
  })
}

module.exports = {
  LEGAL_PAGES,
  openLegalPage
}
