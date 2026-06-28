const api = require('../../utils/api.js')

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
    timer: null,
    
    // 模式切换
    practiceMode: 'answer', // 'answer'-答题模式 'study'-背题模式
    
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
    const { bankId, categoryId, practiceType = '1', title, questionType, wrongMode, favoriteMode, questionIds, currentIndex = '0', resume = '' } = options
    
    this.setData({
      bankId: bankId ? parseInt(bankId) : null,
      categoryId: categoryId ? parseInt(categoryId) : null,
      practiceType: parseInt(practiceType),
      title: title || '练习',
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
    
    // 错题/收藏模式不保存记录和进度
    if (!this.data.wrongMode && !this.data.favoriteMode) {
      // 保存进度
      this.saveProgress()
      
      // 如果有答题记录，自动保存刷题记录
      if (this.data.answerRecords.length > 0) {
        this.autoSaveRecord()
      }
    }
  },

  // 自动保存刷题记录（退出页面时调用）
  async autoSaveRecord() {
    const { bankId, categoryId, practiceType, answerRecords, correctCount, duration } = this.data
    
    try {
      await api.practice.saveRecord({
        bankId,
        categoryId,
        practiceType,
        totalCount: answerRecords.length,
        correctCount,
        duration,
        answers: answerRecords
      })
      console.log('刷题记录已自动保存')
    } catch (error) {
      console.error('自动保存记录失败:', error)
    }
  },

  // 获取进度存储键名
  getProgressKey() {
    const { bankId, categoryId, practiceType } = this.data
    return `${STORAGE_KEY_PRACTICE_PROGRESS}_${bankId || 0}_${categoryId || 0}_${practiceType}`
  },

  // 保存刷题进度
  saveProgress() {
    const { bankId, categoryId, practiceType, questions, currentIndex, answerRecords, correctCount, wrongCount, practiceMode, duration } = this.data
    
    // 如果没有题目或已完成所有题目，清除进度
    if (questions.length === 0 || currentIndex >= questions.length - 1) {
      wx.removeStorageSync(this.getProgressKey())
      return
    }
    
    const progress = {
      bankId,
      categoryId,
      practiceType,
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
    const typeTagHtml = `<span style="color: #07c160; font-weight: 500; margin-right: 8px;">(${typeName})</span>`
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
      questionTitleWithType: questionTitleWithType
    })
    
    // 检查收藏状态
    this.checkFavorite()
  },

  // 选择答案
  onOptionSelect(e) {
    if (this.data.isAnswered) return
    
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
  onSubmitAnswer() {
    if (!this.data.userAnswer) {
      wx.showToast({ title: '请选择答案', icon: 'none' })
      return
    }
    this.submitAnswer()
  },

  // 提交答案
  async submitAnswer() {
    if (this.data.isAnswered) return
    
    const { currentQuestion, userAnswer, wrongMode, favoriteMode } = this.data
    
    // 错题模式或收藏模式下，本地判断答案，不提交到服务器
    if (wrongMode || favoriteMode) {
      this.checkAnswerLocal(currentQuestion, userAnswer)
      return
    }
    
    try {
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
            wrongCount: 0
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
    const timer = setInterval(() => {
      const duration = Math.floor((Date.now() - this.data.startTime) / 1000)
      this.setData({ duration })
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
    const { correctCount, wrongCount, totalCount, duration } = this.data
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
    
    wx.showModal({
      title: '练习完成',
      content: `共${totalCount}题，答对${correctCount}题，正确率${accuracy}%`,
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
    const { bankId, categoryId, practiceType, answerRecords, correctCount, duration, wrongMode, favoriteMode } = this.data
    
    // 错题模式或收藏模式下，直接跳转结果页，不保存记录
    if (wrongMode || favoriteMode) {
      wx.redirectTo({
        url: `/pages/result/result?correct=${correctCount}&wrong=${this.data.wrongCount}&total=${this.data.totalCount}&duration=${duration}`
      })
      return
    }
    
    try {
      await api.practice.saveRecord({
        bankId,
        categoryId,
        practiceType,
        totalCount: answerRecords.length,
        correctCount,
        duration,
        answers: answerRecords
      })
      
      // 跳转到结果页
      wx.redirectTo({
        url: `/pages/result/result?correct=${correctCount}&wrong=${this.data.wrongCount}&total=${this.data.totalCount}&duration=${duration}`
      })
    } catch (error) {
      console.error('保存记录失败:', error)
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
