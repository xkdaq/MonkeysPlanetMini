// utils/rich-html.js
// 轻量 HTML → 小程序 rich-text nodes 转换
// 用途：转盘题目解析字段是后端富文本（p / span / br），小程序无法 innerHTML，
// 这里转成 rich-text 支持的节点数组，保留采分点的绿色高亮与换行。

const BLOCK_TAGS = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'section', 'article', 'blockquote']
const INLINE_TAGS = ['span', 'strong', 'b', 'em', 'i', 'u', 'font', 'small', 'sub', 'sup', 'code', 'a']
// 无意义、直接跳过标签本身但保留内容
const TRANSPARENT_TAGS = ['ul', 'ol', 'tbody', 'table', 'tr', 'td', 'body', 'html']

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&ldquo;': '\u201c',
  '&rdquo;': '\u201d',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&hellip;': '\u2026',
  '&mdash;': '\u2014',
  '&middot;': '\u00b7'
}

function decodeEntities(text) {
  let s = String(text || '')
  Object.keys(ENTITIES).forEach((k) => {
    s = s.split(k).join(ENTITIES[k])
  })
  // 数字实体 &#123;
  s = s.replace(/&#(\d+);/g, (m, code) => String.fromCharCode(parseInt(code, 10)))
  return s
}

// 只保留 rich-text 支持度较好的样式
function pickStyle(styleStr, tagName) {
  const out = []
  const src = String(styleStr || '')
  const color = /color\s*:\s*([^;]+)/i.exec(src)
  const fontSize = /font-size\s*:\s*([^;]+)/i.exec(src)
  const align = /text-align\s*:\s*([^;]+)/i.exec(src)
  if (color) out.push(`color:${color[1].trim()}`)
  if (fontSize) out.push(`font-size:${fontSize[1].trim()}`)
  if (align) out.push(`text-align:${align[1].trim()}`)
  if (tagName === 'strong' || tagName === 'b') out.push('font-weight:bold')
  if (tagName === 'em' || tagName === 'i') out.push('font-style:italic')
  if (tagName === 'u') out.push('text-decoration:underline')
  return out.join(';')
}

function attrValue(attrsStr, name) {
  const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrsStr || '')
  if (!m) return ''
  return m[1] || m[2] || m[3] || ''
}

function textNode(text) {
  return { type: 'text', text }
}

/**
 * 将 HTML 字符串转换为 rich-text 的 nodes 数组
 * @param {string} html
 * @returns {Array} nodes
 */
function parseHtml(html) {
  const nodes = []
  if (!html) return nodes

  const source = String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // 当前块级容器
  let block = null
  // 内联节点栈
  const stack = []
  // 上一个标签是否为 br（用于把连续 br 变成空行）
  let justBr = false

  const container = () => (stack.length ? stack[stack.length - 1].children : null)

  const ensureBlock = () => {
    if (!block) {
      block = { name: 'div', attrs: {}, children: [] }
      nodes.push(block)
    }
    return block
  }

  const pushText = (text) => {
    if (!text) return
    justBr = false
    const target = container() || ensureBlock().children
    target.push(textNode(decodeEntities(text)))
  }

  const tagRe = /<\/?([a-zA-Z0-9]+)([^>]*?)\/?>/g
  let lastIndex = 0
  let match = null

  while ((match = tagRe.exec(source)) !== null) {
    const before = source.slice(lastIndex, match.index)
    if (before) pushText(before)
    lastIndex = tagRe.lastIndex

    const raw = match[0]
    const tagName = match[1].toLowerCase()
    const attrsStr = match[2] || ''
    const isClose = raw[1] === '/'
    const isSelfClose = /\/\s*>$/.test(raw) || ['br', 'img', 'hr'].indexOf(tagName) > -1

    if (tagName === 'br') {
      // rich-text 的 text 节点不渲染 \n，这里用「切断当前块」实现换行；
      // 连续两个 br 生成一个空行块
      if (justBr) {
        nodes.push({ name: 'div', attrs: {}, children: [textNode('\u00A0')] })
      }
      block = null
      stack.length = 0
      justBr = true
      continue
    }
    justBr = false

    if (isClose) {
      if (INLINE_TAGS.indexOf(tagName) > -1) {
        // 关闭最近的同名内联节点，找不到就全部弹出
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === tagName) {
            stack.splice(i, 1)
            break
          }
        }
      } else if (BLOCK_TAGS.indexOf(tagName) > -1) {
        block = null
        stack.length = 0
      }
      continue
    }

    if (isSelfClose) continue

    if (BLOCK_TAGS.indexOf(tagName) > -1) {
      const style = pickStyle(attrValue(attrsStr, 'style'), tagName)
      block = { name: 'div', attrs: style ? { style } : {}, children: [] }
      stack.length = 0
      nodes.push(block)
      continue
    }

    if (INLINE_TAGS.indexOf(tagName) > -1) {
      const style = pickStyle(attrValue(attrsStr, 'style'), tagName)
      const parent = container() || ensureBlock().children
      const node = { type: 'node', name: 'span', attrs: style ? { style } : {}, children: [] }
      parent.push(node)
      stack.push(node)
      continue
    }

    if (TRANSPARENT_TAGS.indexOf(tagName) > -1) continue
  }

  const tail = source.slice(lastIndex)
  if (tail) pushText(tail)

  // 清理：空块直接丢掉
  const clean = []
  nodes.forEach((n) => {
    const hasText = JSON.stringify(n).indexOf('"text"') > -1
    if (hasText) clean.push(n)
  })
  return clean.length ? clean : [{ name: 'div', attrs: {}, children: [textNode('暂无解析')] }]
}

module.exports = { parseHtml }
