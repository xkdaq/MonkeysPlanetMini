/**
 * 访问统计上报 - 对应后端 POST /api/visit/report
 *
 * 后端统计口径（h5_visit_log 表）：
 * - page_view          页面浏览（启动/访问）
 * - detail_view        资料详情查看（资料排行核心指标）
 * - note_detail_view   文章/笔记详情查看（笔记排行核心指标）
 * - baidu_click        百度网盘链接点击
 * - quark_click        夸克网盘链接点击
 *
 * 注意：上报为静默行为——不弹 loading/toast，失败不影响业务流程
 */
const { BASE_URL } = require('./config.js')

// 客户端类型（与后端约定：mini/h5/ios/android）
const CLIENT_TYPE = 'mini'

// 获取当前页面路径（含参数），如 pages/detail/detail?id=1&type=material
function getCurrentPagePath() {
  try {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1]
    if (!current) return ''
    const options = current.options || {}
    const query = Object.keys(options)
      .map(k => `${k}=${options[k]}`)
      .join('&')
    return query ? `${current.route}?${query}` : current.route
  } catch (e) {
    return ''
  }
}

/**
 * 上报访问事件
 * @param {Object} payload
 * @param {string} payload.eventType    事件类型（必填）
 * @param {number} [payload.materialId] 资料/文章ID（数字，后端为 Long）
 * @param {string} [payload.materialTitle] 资料/文章标题
 */
function reportVisit(payload = {}) {
  if (!payload.eventType) return

  wx.request({
    url: `${BASE_URL}/api/visit/report`,
    method: 'POST',
    header: {
      'Content-Type': 'application/json'
    },
    data: {
      clientType: CLIENT_TYPE,
      pagePath: getCurrentPagePath(),
      ...payload
    },
    fail() {
      // 静默失败，统计丢失可接受，不打扰用户
    }
  })
}

module.exports = {
  reportVisit
}
