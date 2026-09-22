// pages/edu/wheel.js
// 抽题大转盘（教育学背诵模块）
// 数据来源：后端 /h5/wheel/*（复用 H5 接口，无需后端改动）
// 绘制方案：逐帧重绘（与 H5 一致），指针与中心按钮画进 canvas，
// 避免 canvas 参与 CSS transform 导致同层渲染异常（指针/按钮被盖住）。

const wheelApi = require('../../utils/wheel-api.js')
const { parseHtml } = require('../../utils/rich-html.js')
const { reportVisit } = require('../../utils/visit.js')

const HISTORY_KEY = 'edu_wheel_history'
const NO_REPEAT_KEY = 'edu_wheel_no_repeat'
const BANK_KEY = 'edu_wheel_bank_id'
const DRAWN_PREFIX = 'edu_wheel_drawn_'
const HISTORY_MAX = 200
const SPIN_DURATION = 4000
const THINK_TIP_THRESHOLD = 3000

// 转盘扇区配色（8 色循环）
const COLORS = [
  '#07C160', '#36C5DD', '#FFB347', '#FF6B81',
  '#A8E6CF', '#FFD93D', '#C490E4', '#F88B6D'
]

Page({
  data: {
    // 题库
    banks: [],
    currentBankId: null,
    currentBankName: '选择题库',
    currentBankDesc: '',
    questionCount: 0,
    questions: [],

    // 页面状态
    loading: true,
    errorMsg: '',
    size: 300,
    spinning: false,

    // 设置
    noRepeat: false,
    drawnCount: 0,

    // 题目卡片
    showQuestion: false,
    qType: '',
    qScore: 0,
    qIndex: 0,
    qTotal: 0,
    qTitle: '',
    analysisNodes: [],
    analysisOpen: false,

    // 弹层
    showBankSheet: false,
    showMoreSheet: false,
    showHistorySheet: false,
    history: [],

    // 思考提示
    showThinkTip: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const size = Math.floor(Math.min(info.windowWidth - 60, 340))
    this.setData({ size })
    this._rotation = 0
    this._dpr = info.pixelRatio || 2
    this.loadBanks()
  },

  onReady() {
    this.initCanvas()
  },

  onUnload() {
    this.cancelRaf()
    if (this._spinTimer) clearTimeout(this._spinTimer)
    if (this._tipTimer) clearTimeout(this._tipTimer)
  },

  // ===== 画布 =====
  initCanvas() {
    wx.createSelectorQuery()
      .in(this)
      .select('#wheelCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          console.error('[wheel] canvas 初始化失败')
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        canvas.width = this.data.size * this._dpr
        canvas.height = this.data.size * this._dpr
        this._canvas = canvas
        this._ctx = ctx
        this.drawWheel()
      })
  },

  raf(cb) {
    if (this._canvas && this._canvas.requestAnimationFrame) {
      return this._canvas.requestAnimationFrame(cb)
    }
    return setTimeout(cb, 16)
  },

  cancelRaf() {
    if (!this._rafId) return
    if (this._canvas && this._canvas.cancelAnimationFrame) {
      this._canvas.cancelAnimationFrame(this._rafId)
    } else {
      clearTimeout(this._rafId)
    }
    this._rafId = null
  },

  drawWheel() {
    const ctx = this._ctx
    const size = this.data.size
    const N = this.data.questions.length
    if (!ctx || !N) return

    // 每帧重置变换，避免 scale 累积
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const cx = size / 2
    const cy = size / 2
    const outerR = size / 2 - 2
    const r = outerR - 6
    const seg = (Math.PI * 2) / N
    const rotationRad = (this._rotation || 0) * Math.PI / 180
    const showLabel = N <= 80

    // 白色底圆（外圈白边）
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // 扇区
    for (let i = 0; i < N; i++) {
      const start = i * seg - Math.PI / 2 + rotationRad
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, start + seg)
      ctx.closePath()
      ctx.fillStyle = COLORS[i % COLORS.length]
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1
      ctx.stroke()

      if (showLabel) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(start + seg / 2)
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#ffffff'
        // 题目多时只画数字，避免文字重叠
        const fontSize = N > 60 ? 8 : N > 40 ? 9 : N > 30 ? 10 : 12
        ctx.font = `bold ${fontSize}px sans-serif`
        const label = N > 30 ? String(i + 1) : `第${i + 1}题`
        ctx.fillText(label, r - 8, 0)
        ctx.restore()
      }
    }

    // 外圈描边
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 1
    ctx.stroke()

    // 指针（固定顶部，不随转盘转）
    ctx.beginPath()
    ctx.moveTo(cx - 13, 2)
    ctx.lineTo(cx + 13, 2)
    ctx.lineTo(cx, 28)
    ctx.closePath()
    ctx.fillStyle = '#07C160'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, 6, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#07C160'
    ctx.fill()

    // 中心按钮
    const centerR = size * 0.135
    ctx.beginPath()
    ctx.arc(cx, cy, centerR + 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, centerR, 0, Math.PI * 2)
    ctx.fillStyle = '#07C160'
    ctx.fill()
    ctx.fillStyle = this.data.spinning ? 'rgba(255,255,255,0.75)' : '#ffffff'
    ctx.font = `bold ${Math.round(centerR * 0.44)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.data.spinning ? '...' : 'GO', cx, cy + 1)
  },

  // 中心点击：判定触点是否落在中心圆内
  onCanvasTap(e) {
    if (this.data.spinning) return
    const detail = e.detail || {}
    if (detail.x === undefined) {
      this.onSpinTap()
      return
    }
    wx.createSelectorQuery()
      .in(this)
      .select('#wheelCanvas')
      .boundingClientRect((rect) => {
        if (!rect) return
        const dx = detail.x - (rect.left + rect.width / 2)
        const dy = detail.y - (rect.top + rect.height / 2)
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist <= rect.width * 0.16) {
          this.onSpinTap()
        }
      })
      .exec()
  },

  // ===== 数据 =====
  async loadBanks() {
    this.setData({ loading: true, errorMsg: '' })
    try {
      const banks = await wheelApi.getBanks()
      if (!banks || !banks.length) {
        this.setData({ loading: false, errorMsg: '暂无可用题库' })
        return
      }
      this.setData({ banks, loading: false })

      this.data.noRepeat = wx.getStorageSync(NO_REPEAT_KEY) === '1'
      this.setData({ noRepeat: this.data.noRepeat })

      const saved = wx.getStorageSync(BANK_KEY)
      const target = banks.find((b) => String(b.id) === String(saved)) || banks[0]
      // 埋点：转盘题库加载（与 H5 同名事件，靠 clientType=mini 区分端）
      reportVisit({
        eventType: 'wheel_bank_load',
        materialId: target.id,
        materialTitle: target.name
      })
      this.selectBank(target.id)
    } catch (e) {
      console.error('[wheel] 题库加载失败:', e)
      this.setData({ loading: false, errorMsg: '题库加载失败，请检查网络' })
    }
  },

  async selectBank(bankId, isSwitch) {
    wx.showLoading({ title: '加载题目...', mask: true })
    try {
      const list = await wheelApi.getQuestions(bankId)
      wx.hideLoading()
      if (!list || !list.length) {
        wx.showToast({ title: '该题库暂无题目', icon: 'none' })
        return
      }
      const bank = this.data.banks.find((b) => String(b.id) === String(bankId)) || {}
      wx.setStorageSync(BANK_KEY, bankId)

      this._rotation = 0
      this.setData({
        currentBankId: bankId,
        currentBankName: bank.name || '未命名题库',
        currentBankDesc: bank.description || `共 ${list.length} 题 · 点击 GO 抽题`,
        questionCount: list.length,
        questions: list,
        showQuestion: false,
        analysisOpen: false
      })
      wx.setNavigationBarTitle({ title: bank.name || '抽题大转盘' })

      if (isSwitch) {
        reportVisit({
          eventType: 'wheel_bank_switch',
          materialId: bankId,
          materialTitle: bank.name
        })
      }

      // 等一帧再画，确保布局完成
      setTimeout(() => this.drawWheel(), 50)
      this.updateDrawnCount()
      this.onBankReady()
    } catch (e) {
      wx.hideLoading()
      console.error('[wheel] 题目加载失败:', e)
      wx.showToast({ title: '题目加载失败', icon: 'none' })
    }
  },

  // ===== 不重复抽题 / 历史 =====
  getDrawnSet(bankId) {
    try {
      const raw = wx.getStorageSync(DRAWN_PREFIX + bankId)
      const arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
      return new Set((arr || []).map(String))
    } catch (e) {
      return new Set()
    }
  },

  saveDrawn(bankId, set) {
    wx.setStorageSync(DRAWN_PREFIX + bankId, Array.from(set))
  },

  updateDrawnCount() {
    if (!this.data.noRepeat || !this.data.currentBankId || !this.data.questions.length) {
      this.setData({ drawnCount: 0 })
      return
    }
    this.setData({ drawnCount: this.getDrawnSet(this.data.currentBankId).size })
  },

  pushHistory(qid, title) {
    let list = []
    try {
      const raw = wx.getStorageSync(HISTORY_KEY)
      list = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
      if (!Array.isArray(list)) list = []
    } catch (e) {
      list = []
    }
    list.unshift({
      bankId: String(this.data.currentBankId),
      bankName: this.data.currentBankName,
      qid: String(qid),
      title: title,
      ts: Date.now()
    })
    if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX)
    wx.setStorageSync(HISTORY_KEY, list)
  },

  loadHistory() {
    let list = []
    try {
      const raw = wx.getStorageSync(HISTORY_KEY)
      list = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
      if (!Array.isArray(list)) list = []
    } catch (e) {
      list = []
    }
    const formatted = list.map((item) => {
      const d = new Date(item.ts)
      const pad = (n) => String(n).padStart(2, '0')
      return Object.assign({}, item, {
        time: `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      })
    })
    this.setData({ history: formatted })
  },

  // ===== 抽题 =====
  onSpinTap() {
    if (this.data.spinning) return
    const N = this.data.questions.length
    if (!N) {
      wx.showToast({ title: '请等待题库加载', icon: 'none' })
      return
    }

    let targetIndex = 0
    const questions = this.data.questions
    if (this.data.noRepeat) {
      const drawn = this.getDrawnSet(this.data.currentBankId)
      const pool = []
      questions.forEach((q, idx) => {
        if (!drawn.has(String(q.id))) pool.push(idx)
      })
      if (!pool.length) {
        wx.showToast({ title: '本题库已抽完，请重置', icon: 'none' })
        return
      }
      targetIndex = pool[Math.floor(Math.random() * pool.length)]
    } else {
      targetIndex = Math.floor(Math.random() * N)
    }

    const seg = 360 / N
    const theta = targetIndex * seg + seg / 2
    const start = this._rotation || 0
    const mod = ((start % 360) + 360) % 360
    let delta = (360 - theta - mod) % 360
    if (delta < 0) delta += 360
    const extra = 5 + Math.floor(Math.random() * 3)
    const final = start + delta + extra * 360

    this.setData({
      spinning: true,
      showQuestion: false,
      analysisOpen: false,
      showThinkTip: false
    })
    this.drawWheel()

    this.cancelRaf()
    const t0 = Date.now()
    const ease = (p) => 1 - Math.pow(1 - p, 3)

    const step = () => {
      const p = Math.min((Date.now() - t0) / SPIN_DURATION, 1)
      this._rotation = start + (final - start) * ease(p)
      this.drawWheel()
      if (p < 1) {
        this._rafId = this.raf(step)
      } else {
        this._rotation = final
        this.drawWheel()
        this.setData({ spinning: false })
        this.showQuestion(targetIndex, false)
        reportVisit({
          eventType: 'wheel_spin',
          materialId: this.data.currentBankId,
          materialTitle: this.data.currentBankName
        })
      }
    }
    this._rafId = this.raf(step)
  },

  showQuestion(index, fromHistory) {
    const q = this.data.questions[index]
    if (!q) return

    if (this.data.noRepeat && this.data.currentBankId != null && q.id != null) {
      const set = this.getDrawnSet(this.data.currentBankId)
      set.add(String(q.id))
      this.saveDrawn(this.data.currentBankId, set)
      this.updateDrawnCount()
    }
    if (!fromHistory) {
      this.pushHistory(q.id, q.title)
    }

    this.setData({
      showQuestion: true,
      qType: q.type || '问答题',
      qScore: q.score || 0,
      qIndex: index + 1,
      qTotal: this.data.questions.length,
      qTitle: q.title || '',
      analysisNodes: parseHtml(q.analysis || ''),
      analysisOpen: false,
      showThinkTip: false
    })
    this._lastSpinFinishedAt = Date.now()
    this._hasShownAnalysis = false
  },

  onToggleAnalysis() {
    const willOpen = !this.data.analysisOpen
    if (willOpen && !this._hasShownAnalysis) {
      const elapsed = Date.now() - (this._lastSpinFinishedAt || 0)
      if (elapsed < THINK_TIP_THRESHOLD) {
        this.setData({ showThinkTip: true })
        if (this._tipTimer) clearTimeout(this._tipTimer)
        this._tipTimer = setTimeout(() => this.setData({ showThinkTip: false }), 1800)
        this._hasShownAnalysis = true
      }
    }
    this.setData({ analysisOpen: willOpen })

    if (willOpen) {
      reportVisit({
        eventType: 'wheel_view_analysis',
        materialId: this.data.currentBankId,
        materialTitle: this.data.currentBankName
      })
    }
  },

  // ===== 弹层 =====
  openBankSheet() {
    this.setData({ showBankSheet: true })
  },
  closeBankSheet() {
    this.setData({ showBankSheet: false })
  },
  onBankSelect(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ showBankSheet: false })
    if (String(id) === String(this.data.currentBankId)) return
    this.selectBank(id, true)
  },

  openMoreSheet() {
    this.setData({ showMoreSheet: true })
  },
  closeMoreSheet() {
    this.setData({ showMoreSheet: false, showHistorySheet: false })
  },
  openHistorySheet() {
    this.loadHistory()
    this.setData({ showHistorySheet: true })
  },
  closeHistorySheet() {
    this.setData({ showHistorySheet: false })
  },
  onHistoryTap(e) {
    const item = e.currentTarget.dataset.item
    this.setData({ showHistorySheet: false, showMoreSheet: false })
    if (String(item.bankId) !== String(this.data.currentBankId)) {
      this.selectBank(item.bankId)
      this._pendingHistory = item
    } else {
      this.jumpToHistory(item)
    }
  },
  jumpToHistory(item) {
    const idx = this.data.questions.findIndex((q) => String(q.id) === String(item.qid))
    if (idx >= 0) {
      this.showQuestion(idx, true)
    } else {
      wx.showToast({ title: '该题目已不在题库中', icon: 'none' })
    }
  },
  clearHistory() {
    wx.removeStorageSync(HISTORY_KEY)
    this.loadHistory()
    wx.showToast({ title: '已清空历史', icon: 'none' })
  },

  onNoRepeatChange(e) {
    const value = e.detail.value
    wx.setStorageSync(NO_REPEAT_KEY, value ? '1' : '0')
    this.setData({ noRepeat: value })
    this.updateDrawnCount()
  },

  resetDrawn() {
    if (this.data.currentBankId == null) {
      wx.showToast({ title: '请先选择题库', icon: 'none' })
      return
    }
    wx.removeStorageSync(DRAWN_PREFIX + this.data.currentBankId)
    this.updateDrawnCount()
    wx.showToast({ title: '已重置本题库记录', icon: 'none' })
  },

  // 题库切换完成后，如果有待跳转的历史题目则跳过去
  onBankReady() {
    if (this._pendingHistory) {
      const item = this._pendingHistory
      this._pendingHistory = null
      setTimeout(() => this.jumpToHistory(item), 300)
    }
  }
})
