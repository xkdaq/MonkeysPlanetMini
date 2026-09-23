const api = require('../../utils/api.js')
const prefs = require('../../utils/prefs.js')

// 本地存储键名
const STORAGE_KEY_PRACTICE_PROGRESS = 'practice_progress'

Page({
  data: {
    // 页面参数
    bankId: null,
    categoryId: null,
    practiceType: 1, // 1-顺序 2-随机 3-专项
    title: '练习',
    
    // 题目数据
    questions: [],
    currentIndex: 0,
    totalCount: 0,
    
    // 当前题目
    currentQuestion: null,
    questionOptions: [],
    
    // 答题状态
    userAnswer: '',
    isAnswered: false,
    isCorrect: false,
    showAnalysis: false,
    
    // 收藏状态
    isFavorite: false,
    
    // 答题记录
    answerRecords: [],
    correctCount: 0,
    wrongCount: 0,
    
    // 计时
    startTime: null,
    duration: 0,
    questionTypeName: '',
    bankName: '',
    categoryName: '',
    timer: null,
    
    // 模式切换 'answer'-答题模式 'study'-背题模式
    // 初值在 onLoad 里按设置页的「默认刷题模式」覆盖；
    // 注意恢复存档时以存档里的模式为准（见 resumeProgress），存档优先级高于全局默认
    practiceMode: 'answer',
    
    // 加载状态
    loading: true,
    
    // 选项字母
    optionLabels: ['A', 'B', 'C', 'D', 'E'],
    
    // 上报弹窗
    showReportModal: false,
    reportTypes: [],
    reportTypeClasses: {},
    reportContent: '',
    
    // 选项样式类
    optionClasses: {},
    
    // 答题卡弹窗
    showCardModal: false,
    
    // 答题卡项样式
    cardItemClasses: {},
    
    // 进度恢复弹窗
    showResumeModal: false,
    savedProgress: null
  },

  onLoad(options) {
    const { bankId, categoryId, practiceType = '1', title, categoryName, bankName, questionType, wrongMode, favoriteMode, questionIds, currentIndex = '0', resume = '', autoResume = '' } = options

    // 小程序会自动 decode 一次 query，这里再兜一层，兼容历史未编码的链接
    const safeDecode = (v) => {
      if (!v || typeof v !== 'string') return ''
      if (v.indexOf('%') === -1) return v
      try { return decodeURIComponent(v) } catch (e) { return v }
    }
    const categoryNameText = safeDecode(categoryName)
    const bankNameText = safeDecode(bankName)

    this.setData({
      bankId: bankId ? parseInt(bankId) : null,
      categoryId: categoryId ? parseInt(categoryId) : null,
      practiceType: parseInt(practiceType),
      // 全局默认刷题模式（设置页可改）；有存档时后面 resumeProgress 会用存档里的覆盖回来
      practiceMode: prefs.getPracticeMode(),
      categoryName: categoryNameText,
      bankName: bankNameText,
      // 章节练习没有单独传 title，用章节名兜底（此前会一律回落成「练习」）
      title: safeDecode(title) || categoryNameText || '练习',
      questionType: questionType ? parseInt(questionType) : null,
      wrongMode: wrongMode === '1',
      favoriteMode: favoriteMode === '1',
      questionIds: questionIds || '',
      currentIndex: parseInt(currentIndex) || 0,
      startTime: Date.now()
    })
    
    // 设置导航栏标题
    wx.setNavigationBarTitle({ title: this.data.title })
    
    // 错题模式或收藏模式下，不恢复进度
    if (wrongMode === '1' || favoriteMode === '1') {
      this.loadQuestions()
      this.startTimer()
      return
    }
    
    // 检查是否有保存的进度
    const progressKey = this.getProgressKey()
    const savedProgress = wx.getStorageSync(progressKey)
    
    // 如果是从恢复进度进入，或者没有保存的进度，正常加载
    if (resume === '1' || !savedProgress) {
      this.loadQuestions()
      this.startTimer()
      
      // 如果有指定当前索引，加载对应题目
      const index = parseInt(currentIndex)
      if (index > 0) {
        this.setData({ currentIndex: index })
      }
    } else if (autoResume === '1' || prefs.getBool('autoResume')) {
      // 从「继续上次练习」进来，或用户在设置页开了「继续上次练习不再询问」：
      // 直接恢复，不弹确认框。恢复逻辑本身不变。
      this.setData({ savedProgress })
      this.resumeProgress()
    } else {
      // 有保存的进度，显示恢复弹窗
      // 计算正确率和用时显示
      const answeredCount = savedProgress.answerRecords?.length || 0
      const correctCount = savedProgress.correctCount || 0
      const duration = savedProgress.duration || 0
      const accuracy = answeredCount > 0 ? Math.round(correctCount / answeredCount * 100) : 0
      const durationText = `${Math.floor(duration / 60)}分${duration % 60}秒`
      
      this.setData({
        savedProgress,
        showResumeModal: true,
        loading: false,
        resumeAccuracy: accuracy,
        resumeDuration: durationText
      })
    }
  },

  onUnload() {
    // 清除计时器
    if (this.data.timer) {
      clearInterval(this.data.timer)
    }

    // 错题/收藏模式不保存进度
    // 正常模式只保存本地进度；练习记录统一在交卷/完成时上报，
    // 避免「中途退出自动上报 + 恢复进度后再次上报」产生重复记录
    if (!this.data.wrongMode && !this.data.favoriteMode) {
      this.saveProgress()
    }
  },

  // 页面隐藏（切后台/跳转其他页面）：暂停计时，记录离开时间
  onHide() {
    this._hiddenAt = Date.now()
    this._timerWasRunning = !!this.data.timer
    if (this.data.timer) {
      clearInterval(this.data.timer)
      this.setData({ timer: null })
    }
  },

  // 页面重新显示：把 startTime 顺延离开时长，使 duration 不含切后台时间
  onShow() {
    if (this._hiddenAt && this.data.startTime) {
      this.setData({ startTime: this.data.startTime + (Date.now() - this._hiddenAt) })
      this._hiddenAt = null
    }
    if (this._timerWasRunning && !this.data.timer) {
      this.startTimer()
      this._timerWasRunning = false
    }
  },

  // 获取进度存储键名
  getProgressKey() {
    const { bankId, categoryId, practiceType } = this.data
    return `${STORAGE_KEY_PRACTICE_PROGRESS}_${bankId || 0}_${categoryId || 0}_${practiceType}`
  },

  // 保存刷题进度
  saveProgress() {
    const { bankId, categoryId, practiceType, questions, currentIndex, answerRecords, correctCount, wrongCount, practiceMode, duration, title, bankName, categoryName } = this.data
    const progressKey = this.getProgressKey()

    // 已交卷（记录已上报）或无题目时，清除进度；其他情况一律保留进度以便恢复
    if (this._recordSaved || questions.length === 0) {
      wx.removeStorageSync(progressKey)
      return
    }
    
    const progress = {
      bankId,
      categoryId,
      practiceType,
      title,
      bankName,
      categoryName,
      currentIndex,
      totalCount: questions.length,
      answerRecords,
      correctCount,
      wrongCount,
      practiceMode,
      duration,
      questionIds: questions.map(q => q.id),
      saveTime: Date.now()
    }
    
    wx.setStorageSync(this.getProgressKey(), progress)
    console.log('刷题进度已保存:', progress)
  },

  // 恢复刷题进度
  async resumeProgress() {
    const { savedProgress } = this.data
    if (!savedProgress) return
    
    // 合并setData，避免多次渲染导致loading闪烁
    this.setData({
      showResumeModal: false,
      loading: true,
      currentIndex: savedProgress.currentIndex || 0,
      answerRecords: savedProgress.answerRecords || [],
      correctCount: savedProgress.correctCount || 0,
      wrongCount: savedProgress.wrongCount || 0,
      // 存档里的模式优先于设置页的全局默认：
      // 用户用背题模式做了一半，退出再进来必须还是背题模式
      practiceMode: savedProgress.practiceMode || 'answer',
      duration: savedProgress.duration || 0,
      startTime: Date.now() - (savedProgress.duration || 0) * 1000
    })
    
    // 加载题目（使用await确保完成后再关闭loading）
    await this.loadQuestionsWithIds(savedProgress.questionIds || [])
    
    // 开始计时
    this.startTimer()
  },

  // 重新开始（清除进度）
  restartPractice() {
    wx.removeStorageSync(this.getProgressKey())
    
    this.setData({
      showResumeModal: false,
      savedProgress: null,
      currentIndex: 0,
      answerRecords: [],
      correctCount: 0,
      wrongCount: 0,
      duration: 0,
      startTime: Date.now()
    })
    
    // 正常加载题目
    this.loadQuestions()
    this.startTimer()
  },

  // 根据题目ID列表加载题目
  async loadQuestionsWithIds(questionIds) {
    // 保持loading状态，避免闪烁
    if (!this.data.loading) {
      this.setData({ loading: true })
    }
    
    try {
      // 使用Promise.all并行加载所有题目，避免多次渲染
      const questionPromises = questionIds.map(id => 
        api.exam.getQuestionDetail(id).catch(e => {
          console.error(`获取题目${id}失败:`, e)
          return null
        })
      )
      
      const results = await Promise.all(questionPromises)
      const questions = results.filter(res => res && res.data).map(res => res.data)
      
      if (questions.length === 0) {
        wx.showToast({ title: '暂无题目', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }
      
      // 一次性设置所有数据，避免多次渲染
      this.setData({
        questions,
        totalCount: questions.length
      })
      
      // 加载当前索引的题目
      this.loadQuestion(this.data.currentIndex || 0)
      
      // 延迟关闭loading，给页面渲染留出时间
      setTimeout(() => {
        this.setData({ loading: false })
      }, 200)
    } catch (error) {
      console.error('加载题目失败:', error)
      this.setData({ loading: false })
    }
  },

  // 加载题目
  async loadQuestions() {
    this.setData({ loading: true })
    
    try {
      let questions = []
      
      // 如果是错题模式或收藏模式，根据questionIds加载指定题目
      if ((this.data.wrongMode || this.data.favoriteMode) && this.data.questionIds) {
        const ids = this.data.questionIds.split(',').filter(id => id).map(id => parseInt(id))
        
        // 批量获取题目详情
        for (const id of ids) {
          try {
            const res = await api.exam.getQuestionDetail(id)
            if (res.data) {
              questions.push(res.data)
            }
          } catch (e) {
            console.error(`获取题目${id}失败:`, e)
          }
        }
      } else {
        // 正常模式，通过API获取题目列表
        const params = {
          bankId: this.data.bankId,
          categoryId: this.data.categoryId,
          practiceType: this.data.practiceType,
          limit: 50
        }
        
        if (this.data.questionType) {
          params.questionType = this.data.questionType
        }
        
        const res = await api.practice.start(params)
        questions = res.data.questions || []
      }
      
      if (questions.length === 0) {
        wx.showToast({ title: '暂无题目', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }
      
      this.setData({
        questions,
        totalCount: questions.length,
        loading: false
      })
      
      // 加载第一题或指定索引的题目
      this.loadQuestion(this.data.currentIndex || 0)
    } catch (error) {
      console.error('加载题目失败:', error)
      this.setData({ loading: false })
    }
  },

  // 加载指定索引的题目
  async loadQuestion(index) {
    if (index < 0 || index >= this.data.totalCount) return
    
    const question = this.data.questions[index]
    
    // 解析选项 - 支持两种格式：JSON字符串 或 "A.xxx|B.xxx|C.xxx|D.xxx" 格式
    let options = []
    if (question.options) {
      try {
        // 先尝试解析为JSON
        const optionsMap = JSON.parse(question.options)
        options = Object.keys(optionsMap).map(key => ({
          label: key,
          content: optionsMap[key]
        }))
      } catch (e) {
        // JSON解析失败，尝试按 "|" 分隔的格式解析
        // 格式：A.xxx|B.xxx|C.xxx|D.xxx
        const optionItems = question.options.split('|')
        options = optionItems.map(item => {
          // 提取选项字母和内容（如 "A.选项内容" -> label: "A", content: "选项内容"）
          const match = item.match(/^([A-E])\.\s*(.+)$/)
          if (match) {
            return {
              label: match[1],
              content: match[2]
            }
          }
          // 如果匹配失败，直接使用整个字符串作为内容
          return {
            label: String.fromCharCode(65 + options.length), // A, B, C...
            content: item
          }
        })
      }
    }
    
    // 更新答题卡样式（当前题目高亮）
    const cardItemClasses = this.computeCardItemClasses(this.data.answerRecords)
    
    // 检查当前题目是否已有答题记录
    const existingRecord = this.data.answerRecords.find(r => r.questionId === question.id)
    const isAnswered = !!existingRecord
    const isCorrect = existingRecord ? existingRecord.isCorrect : false
    const userAnswer = existingRecord ? existingRecord.userAnswer : ''
    
    // 根据模式确定是否显示解析
    // 背题模式下始终显示解析，答题模式下根据是否已答题决定
    const { practiceMode } = this.data
    const showAnalysis = practiceMode === 'study' || isAnswered
    
    // 计算选项样式类
    let optionClasses = {}
    if (isAnswered) {
      optionClasses = this.computeOptionClasses(isCorrect, userAnswer, question.answer)
    }
    
    // 拼接题型标签和题目内容
    const typeNames = {
      1: '单选题',
      2: '多选题',
      3: '判断题',
      4: '填空题',
      5: '问答题',
      6: '材料题'
    }
    const typeName = typeNames[question.type] || ''
    // 题型标签拼在题干最前面，随正文一起换行。
    // 注意：rich-text 里内联元素的 margin 不生效（这正是之前标签和题干挤在一起的原因），
    // 间距只能靠 padding + 后面跟的 &nbsp; 撑开。色值也必须写字面值，
    // 因为 rich-text 不继承页面上的 CSS 变量。
    const typeTagHtml = `<span style="color:#09814a;background:#f1faf5;font-size:24rpx;font-weight:600;padding:4rpx 14rpx;border-radius:8rpx;">${typeName}</span>&nbsp;&nbsp;`
    const questionTitleWithType = typeTagHtml + (question.content || '')
    
    this.setData({
      currentIndex: index,
      currentQuestion: question,
      questionOptions: options,
      userAnswer: userAnswer,
      isAnswered: isAnswered,
      isCorrect: isCorrect,
      showAnalysis: showAnalysis,
      optionClasses: optionClasses,
      cardItemClasses,
      questionTitleWithType: questionTitleWithType,
      questionTypeName: typeName
    })
    
    // 检查收藏状态
    this.checkFavorite()
  },

  // 选择答案
  onOptionSelect(e) {
    // 已作答或提交中，禁止重复操作（接口未返回前 isAnswered 仍为 false，需加锁）
    if (this.data.isAnswered || this._submitting) return
    
    const { label } = e.currentTarget.dataset
    const question = this.data.currentQuestion
    
    let userAnswer = label
    
    // 多选题支持多选
    if (question.type === 2) {
      const currentAnswer = this.data.userAnswer
      const answers = currentAnswer ? currentAnswer.split('') : []
      const index = answers.indexOf(label)
      
      if (index > -1) {
        answers.splice(index, 1)
      } else {
        answers.push(label)
      }
      
      // 排序后拼接
      answers.sort()
      userAnswer = answers.join('')
    }
    
    // 更新选项样式（未提交时显示选中状态）
    const optionClasses = {}
    if (!this.data.isAnswered) {
      this.data.questionOptions.forEach(opt => {
        if (userAnswer.includes(opt.label)) {
          optionClasses[opt.label] = 'selected'
        }
      })
    }
    
    this.setData({ userAnswer, optionClasses })
    
    // 单选题和判断题直接提交
    if (question.type === 1 || question.type === 3) {
      this.submitAnswer()
    }
  },

  // 提交答案（多选题使用）
  // 填空题 / 问答题输入（此前 WXML 绑定了但 JS 缺失，导致输入内容没有存进 userAnswer）
  onTextInput(e) {
    if (this.data.isAnswered) return
    this.setData({ userAnswer: e.detail.value })
  },

  onSubmitAnswer() {
    if (this._submitting) return
    if (!this.data.userAnswer) {
      wx.showToast({ title: '请选择答案', icon: 'none' })
      return
    }
    this.submitAnswer()
  },

  // 提交答案
  async submitAnswer() {
    if (this.data.isAnswered || this._submitting) return
    this._submitting = true

    const { currentQuestion, userAnswer, wrongMode, favoriteMode } = this.data

    try {
      // 错题模式或收藏模式下，本地判断答案，不提交到服务器
      if (wrongMode || favoriteMode) {
        this.checkAnswerLocal(currentQuestion, userAnswer)
        return
      }

      const res = await api.practice.submit({
        questionId: currentQuestion.id,
        userAnswer
      })

      const { isCorrect, correctAnswer, analysis } = res.data

      // 记录答题
      const record = {
        questionId: currentQuestion.id,
        userAnswer,
        isCorrect
      }

      const answerRecords = [...this.data.answerRecords, record]

      // 计算选项样式类
      const optionClasses = this.computeOptionClasses(isCorrect, userAnswer, correctAnswer)

      // 更新答题卡样式
      const cardItemClasses = this.computeCardItemClasses(answerRecords)

      this.setData({
        isAnswered: true,
        isCorrect,
        showAnalysis: true,
        answerRecords,
        correctCount: isCorrect ? this.data.correctCount + 1 : this.data.correctCount,
        wrongCount: !isCorrect ? this.data.wrongCount + 1 : this.data.wrongCount,
        optionClasses,
        cardItemClasses
      })

      // 更新题目数据（显示正确答案和解析）
      const questions = this.data.questions
      questions[this.data.currentIndex].correctAnswer = correctAnswer
      questions[this.data.currentIndex].analysis = analysis
      this.setData({ questions })

    } catch (error) {
      console.error('提交答案失败:', error)
    } finally {
      this._submitting = false
    }
  },

  // 本地判断答案（用于错题/收藏模式）
  checkAnswerLocal(question, userAnswer) {
    if (!userAnswer || !question.answer) {
      this.setLocalAnswerResult(false, question.answer, question.analysis)
      return
    }

    const correctAnswer = question.answer.trim().toUpperCase()
    const answer = userAnswer.trim().toUpperCase()
    
    let isCorrect = false
    
    // 多选题需要排序后比较
    if (question.type === 2) {
      const userChars = answer.split('').sort()
      const correctChars = correctAnswer.split('').sort()
      isCorrect = userChars.join('') === correctChars.join('')
    } else {
      isCorrect = answer === correctAnswer
    }
    
    this.setLocalAnswerResult(isCorrect, correctAnswer, question.analysis)
  },

  // 设置本地答题结果
  setLocalAnswerResult(isCorrect, correctAnswer, analysis) {
    const { currentQuestion } = this.data
    
    // 记录答题
    const record = {
      questionId: currentQuestion.id,
      userAnswer: this.data.userAnswer,
      isCorrect
    }
    
    const answerRecords = [...this.data.answerRecords, record]
    
    // 计算选项样式类
    const optionClasses = this.computeOptionClasses(isCorrect, this.data.userAnswer, correctAnswer)
    
    // 更新答题卡样式
    const cardItemClasses = this.computeCardItemClasses(answerRecords)
    
    this.setData({
      isAnswered: true,
      isCorrect,
      showAnalysis: true,
      answerRecords,
      correctCount: isCorrect ? this.data.correctCount + 1 : this.data.correctCount,
      wrongCount: !isCorrect ? this.data.wrongCount + 1 : this.data.wrongCount,
      optionClasses,
      cardItemClasses
    })
    
    // 更新题目数据
    const questions = this.data.questions
    questions[this.data.currentIndex].correctAnswer = correctAnswer
    questions[this.data.currentIndex].analysis = analysis
    this.setData({ questions })
  },

  // 上一题
  onPrevTap() {
    if (this.data.currentIndex > 0) {
      this.loadQuestion(this.data.currentIndex - 1)
    }
  },

  // 下一题
  onNextTap() {
    if (this.data.currentIndex < this.data.totalCount - 1) {
      this.loadQuestion(this.data.currentIndex + 1)
    } else {
      // 最后一题，显示完成弹窗
      this.showCompleteDialog()
    }
  },

  // 题号导航 - 显示答题卡
  onQuestionNav() {
    this.setData({ showCardModal: true })
  },

  // 隐藏答题卡
  hideCardModal() {
    this.setData({ showCardModal: false })
  },

  // 点击答题卡项
  onCardItemTap(e) {
    const index = e.currentTarget.dataset.index
    this.loadQuestion(index)
    this.hideCardModal()
  },

  // 重做练习
  onRedoPractice() {
    wx.showModal({
      title: '确认重做',
      content: '确定要重新开始练习吗？当前进度将丢失。',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            currentIndex: 0,
            answerRecords: [],
            correctCount: 0,
            wrongCount: 0,
            duration: 0,
            startTime: Date.now()
          })
          this.loadQuestion(0)
          this.hideCardModal()
        }
      }
    })
  },

  // 切换收藏
  async onFavoriteTap() {
    if (!this.data.currentQuestion) return
    
    try {
      const res = await api.favorite.toggle(this.data.currentQuestion.id)
      const isFavorite = res.data
      
      this.setData({ isFavorite })
      
      wx.showToast({
        title: isFavorite ? '收藏成功' : '取消收藏',
        icon: 'none'
      })
    } catch (error) {
      console.error('切换收藏失败:', error)
    }
  },

  // 从错题练习中手动移除当前错题
  onRemoveWrongTap() {
    const currentQuestion = this.data.currentQuestion
    if (!currentQuestion || !this.data.wrongMode) return

    wx.showModal({
      title: '移除错题',
      content: '确定将当前题目从错题本中移除吗？',
      confirmText: '移除',
      success: async (res) => {
        if (!res.confirm) return

        try {
          await api.wrong.remove(currentQuestion.id)
          this.removeCurrentQuestionFromWrongMode()
          wx.showToast({ title: '已移除', icon: 'success' })
        } catch (error) {
          console.error('移除错题失败:', error)
          wx.showToast({ title: '移除失败', icon: 'none' })
        }
      }
    })
  },

  removeCurrentQuestionFromWrongMode() {
    const { questions, currentIndex, answerRecords, currentQuestion } = this.data
    const nextQuestions = questions.filter(q => q.id !== currentQuestion.id)
    const nextAnswerRecords = answerRecords.filter(record => record.questionId !== currentQuestion.id)

    if (nextQuestions.length === 0) {
      this.setData({
        questions: [],
        totalCount: 0,
        answerRecords: nextAnswerRecords,
        correctCount: 0,
        wrongCount: 0
      })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }

    const nextIndex = currentIndex >= nextQuestions.length ? nextQuestions.length - 1 : currentIndex
    const correctCount = nextAnswerRecords.filter(record => record.isCorrect).length
    const wrongCount = nextAnswerRecords.filter(record => !record.isCorrect).length

    this.setData({
      questions: nextQuestions,
      totalCount: nextQuestions.length,
      answerRecords: nextAnswerRecords,
      correctCount,
      wrongCount,
      currentIndex: nextIndex
    })
    this.loadQuestion(nextIndex)
  },

  // 检查收藏状态
  async checkFavorite() {
    if (!this.data.currentQuestion) return
    
    try {
      const res = await api.favorite.check(this.data.currentQuestion.id)
      this.setData({ isFavorite: res.data })
    } catch (error) {
      console.error('检查收藏失败:', error)
    }
  },

  // 切换答题/背题模式
  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ practiceMode: mode })
    
    // 背题模式直接显示答案
    if (mode === 'study') {
      this.setData({
        showAnalysis: true,
        isAnswered: true
      })
    } else {
      // 答题模式重置当前题
      this.loadQuestion(this.data.currentIndex)
    }
  },

  // 开始计时
  startTimer() {
    // duration 不参与渲染（WXML 里没有绑定），直接写 data 不触发 setData，
    // 避免刷题页每秒做一次无意义的视图层重渲染。
    // 注意：若以后要在页面上显示用时，这里必须改回 setData。
    const timer = setInterval(() => {
      this.data.duration = Math.floor((Date.now() - this.data.startTime) / 1000)
    }, 1000)

    this.setData({ timer })
  },

  // 格式化时间
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  },

    // 计算选项样式类
  computeOptionClasses(isCorrect, userAnswer, correctAnswer) {
    const { currentQuestion, questionOptions } = this.data
    const classes = {}
    
    questionOptions.forEach(opt => {
      const label = opt.label
      const isCorrectOption = correctAnswer && correctAnswer.includes(label)
      const isUserSelected = userAnswer && userAnswer.includes(label)
      
      // 用户选错的（选了但不是正确答案）- 红色
      if (isUserSelected && !isCorrectOption) {
        classes[label] = 'wrong'
      }
      // 漏选（多选题中，用户没选但正确答案有）- 黄色
      else if (currentQuestion.type === 2 && !isCorrect && isCorrectOption && !isUserSelected) {
        classes[label] = 'missed'
      }
      // 正确答案 - 绿色
      else if (isCorrectOption) {
        classes[label] = 'correct'
      }
    })
    
    return classes
  },

  // 计算答题卡项样式类
  computeCardItemClasses(answerRecords) {
    const { questions, currentIndex } = this.data
    const classes = {}
    
    questions.forEach((q, index) => {
      const record = answerRecords.find(r => r.questionId === q.id)
      let className = ''
      
      // 当前题目
      if (index === currentIndex) {
        className += ' current'
      }
      
      if (record) {
        if (record.isCorrect) {
          className += ' correct'
        } else {
          className += ' wrong'
        }
      }
      
      classes[index] = className
    })
    
    return classes
  },

  // 显示完成弹窗
  showCompleteDialog() {
    const { correctCount, totalCount, answerRecords } = this.data
    const answered = answerRecords.length
    // 正确率按已答题数计算，与上报口径（totalCount=已答数）保持一致
    const accuracy = answered > 0 ? Math.round((correctCount / answered) * 100) : 0

    wx.showModal({
      title: '练习完成',
      content: `共${totalCount}题，已答${answered}题，答对${correctCount}题，正确率${accuracy}%`,
      confirmText: '查看结果',
      cancelText: '继续练习',
      success: (res) => {
        if (res.confirm) {
          this.saveRecordAndNavigate()
        }
      }
    })
  },

  // 保存记录并跳转结果页
  async saveRecordAndNavigate() {
    // 防止重复点击导致重复上报
    if (this._savingRecord) return

    const { bankId, categoryId, practiceType, questionType, answerRecords, correctCount, duration, wrongMode, favoriteMode } = this.data
    const answered = answerRecords.length

    // 错题模式或收藏模式下，直接跳转结果页，不保存记录
    if (wrongMode || favoriteMode) {
      const mode = wrongMode ? 'wrong' : 'favorite'
      wx.redirectTo({
        url: `/pages/result/result?correct=${correctCount}&wrong=${this.data.wrongCount}&total=${this.data.totalCount}&duration=${duration}&answered=${answered}&bankId=${bankId || ''}&mode=${mode}`
      })
      return
    }

    this._savingRecord = true
    try {
      await api.practice.saveRecord({
        bankId,
        categoryId,
        practiceType,
        totalCount: answered,
        correctCount,
        duration,
        answers: answerRecords
      })

      // 标记记录已上报，onUnload 保存进度时会据此清除进度，避免重复统计
      this._recordSaved = true

      // 跳转到结果页（携带「再来一次」所需的练习参数）
      let url = `/pages/result/result?correct=${correctCount}&wrong=${this.data.wrongCount}&total=${this.data.totalCount}&duration=${duration}&answered=${answered}&bankId=${bankId || ''}&practiceType=${practiceType}&title=${encodeURIComponent(this.data.title)}`
      if (categoryId) url += `&categoryId=${categoryId}`
      if (questionType) url += `&questionType=${questionType}`
      wx.redirectTo({ url })
    } catch (error) {
      console.error('保存记录失败:', error)
      wx.showToast({ title: '记录保存失败，请重试', icon: 'none' })
    } finally {
      this._savingRecord = false
    }
  },

  // 交卷
  onSubmitTap() {
    wx.showModal({
      title: '确认交卷',
      content: `已答${this.data.answerRecords.length}/${this.data.totalCount}题，确定交卷吗？`,
      success: (res) => {
        if (res.confirm) {
          this.saveRecordAndNavigate()
        }
      }
    })
  },

  // 显示上报弹窗
  showReportModal() {
    this.setData({
      showReportModal: true,
      reportTypes: [],
      reportTypeClasses: {},
      reportContent: ''
    })
  },

  // 隐藏上报弹窗
  hideReportModal() {
    this.setData({ showReportModal: false })
  },

  // 切换上报类型
  toggleReportType(e) {
    const type = e.currentTarget.dataset.type
    const reportTypes = this.data.reportTypes
    const index = reportTypes.indexOf(type)
    
    if (index > -1) {
      reportTypes.splice(index, 1)
    } else {
      reportTypes.push(type)
    }
    
    // 更新样式类
    const reportTypeClasses = {}
    reportTypes.forEach(t => {
      reportTypeClasses[t] = 'selected'
    })
    
    this.setData({ 
      reportTypes: [...reportTypes],
      reportTypeClasses
    })
  },

  // 输入上报内容
  onReportInput(e) {
    this.setData({ reportContent: e.detail.value })
  },

  // 提交上报
  async submitReport() {
    const { reportTypes, reportContent, currentQuestion } = this.data
    
    if (reportTypes.length === 0 && !reportContent.trim()) {
      wx.showToast({ title: '请选择或填写反馈内容', icon: 'none' })
      return
    }
    
    try {
      // 调用上报API
      await api.exam.reportQuestion({
        questionId: currentQuestion.id,
        types: reportTypes,
        content: reportContent
      })
      
      wx.showToast({ title: '反馈提交成功', icon: 'success' })
      this.hideReportModal()
    } catch (error) {
      console.error('提交反馈失败:', error)
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  },

  // 复制解析
  copyAnalysis() {
    const analysis = this.data.currentQuestion?.analysis
    if (!analysis) {
      wx.showToast({ title: '暂无解析', icon: 'none' })
      return
    }
    
    // 去除HTML标签，只保留纯文本
    const plainText = analysis.replace(/<[^>]+>/g, '')
    
    wx.setClipboardData({
      data: plainText,
      success: () => {
        wx.showToast({ title: '解析已复制', icon: 'success' })
      }
    })
  }
})
