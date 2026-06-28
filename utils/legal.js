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

function openLegalPage(type) {
  const page = LEGAL_PAGES[type]
  if (!page) {
    return
  }
  wx.navigateTo({
    url: `/pages/webview/webview?url=${encodeURIComponent(page.url)}&title=${encodeURIComponent(page.title)}`
  })
}

module.exports = {
  LEGAL_PAGES,
  openLegalPage
}
