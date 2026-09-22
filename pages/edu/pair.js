// pages/edu/pair.js
// 教育学帽子题 · 配对连连看（12 关 · 96 组）
// 题库内置在本地 utils/edu-pairs.js，离线可玩

const { LEVELS } = require('../../utils/edu-pairs.js')
const { reportVisit } = require('../../utils/visit.js')

const KEY = 'edu_pair_v1'
const WRONG = -1

// 卡片短暂状态动画时长
const BAD_DELAY = 450
const GOOD_DELAY = 480

Page({
  data: {
    totalLevels: LEVELS.length,

    // 关卡
    lvIndex: 0,
    unlocked: 0,
    levelName: '',
    levelLabel: '',
    remain: 0,
    progress: 0,

    // 统计
    score: 0,
    combo: 0,
    cleared: 0,
    accuracy: '—',
    timeText: '00:00',

    // 棋盘
    qCards: [],
    aCards: [],

    // 开关
    reveal: false,
    vibrate: true,
    wrongCount: 0,

    // 交互状态
    busy: false,
    hintFree: 1,
    showLevelSheet: false,
    levelOptions: [],
    hasWrong: false,
    showResult: false,
    resultTitle: '',
    resultLead: '',
    showWrongBtn: false
  },

  onLoad() {
    this.load()
    this.startLevel(this.data.lvIndex, true)
    this.startClock()
  },

  onUnload() {
    this.stopClock()
    this.save()
  },

  onHide() {
    this.save()
  },

  // ===== 存档 =====
  save() {
    try {
      wx.setStorageSync(KEY, {
        lvIndex: this.data.lvIndex === WRONG ? 0 : this.data.lvIndex,
        unlocked: this.data.unlocked,
        score: this.data.score,
        combo: this.data.combo,
        cleared: this.data.cleared,
        hits: this._hits || 0,
        tries: this._tries || 0,
        secs: this._secs || 0,
        wrongSet: this._wrongSet || [],
        vibrate: this.data.vibrate,
        reveal: this.data.reveal
      })
    } catch (e) {
      console.error('[pair] 存档失败:', e)
    }
  },

  load() {
    // 先初始化内部计数，读档失败/无存档时也有默认值
    this._hits = 0
    this._tries = 0
    this._secs = 0
    this._wrongSet = []

    let raw = null
    try {
      const d = wx.getStorageSync(KEY)
      if (d) raw = typeof d === 'string' ? JSON.parse(d) : d
    } catch (e) {
      console.error('[pair] 读档失败:', e)
    }
    if (!raw) return

    try {
      this.data.unlocked = Math.min(raw.unlocked || 0, LEVELS.length - 1)
      this.data.lvIndex = Math.min(raw.lvIndex || 0, this.data.unlocked)
      this.data.score = raw.score || 0
      this.data.combo = raw.combo || 0
      this.data.cleared = raw.cleared || 0
      this._hits = raw.hits || 0
      this._tries = raw.tries || 0
      this._secs = raw.secs || 0
      this._wrongSet = Array.isArray(raw.wrongSet) ? raw.wrongSet : []
      this.data.vibrate = raw.vibrate !== false
      this.data.reveal = raw.reveal === true
    } catch (e) {
      console.error('[pair] 读档失败:', e)
    }
  },

  // ===== 计时 =====
  startClock() {
    this.stopClock()
    this._timer = setInterval(() => {
      this._secs = (this._secs || 0) + 1
      this.setData({ timeText: this.fmt(this._secs) })
      if (this._secs % 10 === 0) this.save()
    }, 1000)
  },

  stopClock() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  fmt(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0')
    const s = String(sec % 60).padStart(2, '0')
    return `${m}:${s}`
  },

  // ===== 关卡 =====
  startLevel(idx, keepScore) {
    const isWrong = idx === WRONG
    const pairs = isWrong ? this.wrongPairs() : LEVELS[idx].pairs

    if (!pairs.length) {
      wx.showToast({ title: '暂无可练习内容', icon: 'none' })
      return
    }

    if (!keepScore) this.data.combo = 0

    this._cards = []
    pairs.forEach((p, i) => {
      const ref = p.ref !== undefined ? p.ref : `${idx}_${i}`
      this._cards.push({ id: `q${i}`, ref, type: 'q', text: p.q, done: false })
      this._cards.push({ id: `a${i}`, ref, type: 'a', text: p.a, done: false })
    })
    this._left = pairs.length
    this._picked = null
    this.data.busy = false
    this.data.hintFree = 1

    const levelLabel = isWrong
      ? `错题重练 · 共 ${pairs.length} 组`
      : `第 ${idx + 1} 关 / 共 ${LEVELS.length} 关`

    this.setData({
      lvIndex: idx,
      levelName: isWrong ? '错题重练' : LEVELS[idx].name,
      levelLabel,
      combo: this.data.combo,
      busy: false,
      hintFree: 1,
      showResult: false
    })

    this.paint()
    this.save()

    reportVisit({
      eventType: isWrong ? 'pair_wrong_practice' : 'pair_level_start',
      materialId: isWrong ? 0 : idx + 1,
      materialTitle: isWrong ? '错题重练' : LEVELS[idx].name
    })
  },

  wrongPairs() {
    const seen = {}
    const out = []
    ;(this._wrongSet || []).forEach((k) => {
      if (seen[k]) return
      seen[k] = 1
      const parts = k.split('_')
      const l = Number(parts[0])
      const i = Number(parts[1])
      if (LEVELS[l] && LEVELS[l].pairs[i]) {
        out.push(Object.assign({}, LEVELS[l].pairs[i], { ref: k }))
      }
    })
    return out
  },

  shuffle(arr) {
    const r = arr.slice()
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = r[i]
      r[i] = r[j]
      r[j] = t
    }
    return r
  },

  // 重建两栏卡片
  paint() {
    const cards = this._cards || []
    const map = (c) => ({
      id: c.id,
      text: c.text,
      done: c.done,
      sel: c.sel === true,
      bad: c.bad === true,
      good: c.good === true,
      hint: c.hint === true
    })
    this.setData({
      qCards: this.shuffle(cards.filter((c) => c.type === 'q')).map(map),
      aCards: this.shuffle(cards.filter((c) => c.type === 'a')).map(map)
    })
    this.syncStats()
  },

  syncStats() {
    const total = (this._cards || []).length / 2
    const done = total - this._left
    const acc = this._tries ? `${Math.round((this._hits / this._tries) * 100)}%` : '—'
    this.setData({
      remain: this._left,
      progress: total ? Math.round((done / total) * 100) : 0,
      accuracy: acc,
      score: this.data.score,
      combo: this.data.combo,
      cleared: this.data.cleared,
      wrongCount: (this._wrongSet || []).length
    })
  },

  // ===== 交互 =====
  onCardTap(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.busy) return
    const cards = this._cards || []
    const card = cards.find((c) => c.id === id)
    if (!card || card.done) return

    this.clearHint()

    if (!this._picked) {
      this._picked = card
      card.sel = true
      this.buzz('light')
      this.paint()
      return
    }

    if (this._picked.id === id) {
      card.sel = false
      this._picked = null
      this.paint()
      return
    }

    const first = this._picked
    card.sel = true

    // 同栏点击：抖动提示
    if (first.type === card.type) {
      this.data.busy = true
      this.data.combo = 0
      first.bad = true
      card.bad = true
      this.buzz('heavy')
      this.paint()
      setTimeout(() => {
        first.bad = false
        card.bad = false
        first.sel = false
        card.sel = false
        this._picked = null
        this.data.busy = false
        this.paint()
      }, BAD_DELAY)
      return
    }

    this._tries = (this._tries || 0) + 1

    if (first.ref === card.ref) {
      // 配对成功
      this.data.busy = true
      this._hits = (this._hits || 0) + 1
      this.data.combo = (this.data.combo || 0) + 1
      this.data.score = (this.data.score || 0) + 10 + (this.data.combo - 1) * 2
      this.data.cleared = (this.data.cleared || 0) + 1
      this._left = this._left - 1

      first.good = true
      card.good = true
      this.buzz('light')
      this.paint()

      const wi = (this._wrongSet || []).indexOf(card.ref)
      if (wi > -1) this._wrongSet.splice(wi, 1)

      setTimeout(() => {
        first.done = true
        card.done = true
        first.good = false
        card.good = false
        first.sel = false
        card.sel = false
        this._picked = null
        this.data.busy = false
        this.paint()
        if (this._left === 0) this.finish()
      }, GOOD_DELAY)
      return
    }

    // 配对失败
    this.data.busy = true
    this.data.combo = 0
    first.bad = true
    card.bad = true
    this.buzz('heavy')
    this.paint()

    const qCard = first.type === 'q' ? first : card
    const aCard = first.type === 'q' ? card : first
    if (this._wrongSet.indexOf(qCard.ref) < 0) this._wrongSet.push(qCard.ref)

    if (this.data.reveal) {
      const right = (this._cards || []).find((c) => c.ref === qCard.ref && c.type !== qCard.type)
      wx.showModal({
        title: '搭配错误',
        content: `「${qCard.text}」\n正确答案：${right ? right.text : aCard.text}`,
        showCancel: false,
        confirmText: '知道了'
      })
      if (right) right.hint = true
    } else {
      wx.showToast({ title: '不匹配', icon: 'none', duration: 1000 })
    }

    setTimeout(() => {
      first.bad = false
      card.bad = false
      first.sel = false
      card.sel = false
      this._picked = null
      this.data.busy = false
      this.paint()
    }, BAD_DELAY)
  },

  clearHint() {
    ;(this._cards || []).forEach((c) => { c.hint = false })
  },

  buzz(type) {
    if (!this.data.vibrate) return
    try {
      wx.vibrateShort({ type: type === 'heavy' ? 'heavy' : 'light' })
    } catch (e) {
      // 部分机型不支持，忽略
    }
  },

  // ===== 流程 =====
  finish() {
    const idx = this.data.lvIndex
    if (idx === WRONG) {
      this.stopClock()
      this.save()
      this.setData({
        showResult: true,
        resultTitle: '错题清空',
        resultLead: '错题已全部消除，可返回正式关卡继续复习。',
        showWrongBtn: false
      })
      return
    }

    if (idx < LEVELS.length - 1) {
      const next = Math.max(this.data.unlocked, idx + 1)
      this.data.unlocked = next
      wx.showToast({ title: `第 ${idx + 1} 关完成`, icon: 'none', duration: 1200 })
      reportVisit({
        eventType: 'pair_level_finish',
        materialId: idx + 1,
        materialTitle: LEVELS[idx].name
      })
      setTimeout(() => {
        this.startLevel(idx + 1, true)
      }, 900)
    } else {
      this.data.unlocked = LEVELS.length - 1
      this.stopClock()
      this.save()
      this.setData({
        showResult: true,
        resultTitle: '全部通关',
        resultLead: '12 关 96 组帽子题全部消除，中外教育史基础打得扎实。',
        showWrongBtn: (this._wrongSet || []).length > 0
      })
      reportVisit({
        eventType: 'pair_game_clear',
        materialId: LEVELS.length,
        materialTitle: '全部通关'
      })
    }
  },

  closeResult() {
    this.setData({ showResult: false })
  },

  // ===== 操作 =====
  onHint() {
    if (this.data.busy || !this._left) return
    const pool = (this._cards || []).filter((c) => !c.done)
    if (!pool.length) return

    if (this.data.hintFree > 0) {
      this.data.hintFree = 0
    } else if ((this.data.score || 0) >= 20) {
      this.data.score = this.data.score - 20
    } else {
      wx.showToast({ title: '分数不足 20，无法使用提示', icon: 'none' })
      return
    }

    this.data.combo = 0
    const ref = this.shuffle(pool)[0].ref
    ;(this._cards || []).forEach((c) => {
      if (c.ref === ref && !c.done) c.hint = true
    })
    this.setData({ hintFree: this.data.hintFree })
    this.paint()
    this.save()

    setTimeout(() => {
      this.clearHint()
      this.paint()
    }, 3000)
  },

  onShuffle() {
    if (this.data.busy) return
    if (this._picked) {
      this._picked.sel = false
      this._picked = null
    }
    this.clearHint()
    this.buzz('light')
    this.paint()
  },

  onReset() {
    wx.showModal({
      title: '重新开始',
      content: '将清空得分、关卡解锁进度和错题本，确定继续？',
      success: (res) => {
        if (!res.confirm) return
        try {
          wx.removeStorageSync(KEY)
        } catch (e) {}
        this.stopClock()
        this.data.score = 0
        this.data.combo = 0
        this.data.cleared = 0
        this._hits = 0
        this._tries = 0
        this._secs = 0
        this._wrongSet = []
        this.data.unlocked = 0
        this.setData({ timeText: '00:00', showResult: false })
        this.startLevel(0, false)
        this.startClock()
        wx.showToast({ title: '已重新开始', icon: 'none' })
      }
    })
  },

  enterWrong() {
    if (!(this._wrongSet || []).length) {
      wx.showToast({ title: '还没有错题记录', icon: 'none' })
      return
    }
    this.setData({ showResult: false, showLevelSheet: false })
    this.startLevel(WRONG, true)
  },

  // ===== 开关 =====
  onToggleReveal() {
    this.data.reveal = !this.data.reveal
    this.setData({ reveal: this.data.reveal })
    wx.showToast({
      title: this.data.reveal ? '已开启：错误时公布正确答案' : '已关闭：错误只提示不匹配',
      icon: 'none',
      duration: 1800
    })
    this.save()
  },

  onToggleVibrate() {
    this.data.vibrate = !this.data.vibrate
    this.setData({ vibrate: this.data.vibrate })
    if (this.data.vibrate) this.buzz('light')
    this.save()
  },

  // ===== 关卡选择 =====
  openLevelSheet() {
    const list = LEVELS.map((lv, i) => {
      const locked = i > this.data.unlocked
      const meta = i === this.data.lvIndex ? '当前' : (i < this.data.unlocked ? '已通关' : (i === this.data.unlocked ? '进行中' : '未解锁'))
      return {
        index: i,
        name: lv.name,
        meta,
        locked,
        active: i === this.data.lvIndex
      }
    })
    this.setData({
      showLevelSheet: true,
      levelOptions: list,
      hasWrong: (this._wrongSet || []).length > 0
    })
  },

  closeLevelSheet() {
    this.setData({ showLevelSheet: false })
  },

  onLevelSelect(e) {
    const idx = Number(e.currentTarget.dataset.index)
    if (idx === WRONG) {
      this.enterWrong()
      return
    }
    if (idx > this.data.unlocked) return
    this.setData({ showLevelSheet: false })
    if (idx === this.data.lvIndex) return
    this.startLevel(idx, true)
  }
})
