const api = require('../../utils/api.js')
const { upload } = require('../../utils/request.js')

Page({
  data: {
    userInfo: null,
    nickname: '',
    gender: 0,
    avatarUrl: ''
  },

  onLoad() {
    this.loadUserInfo()
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo,
        nickname: userInfo.nickname || '',
        gender: userInfo.gender || 0,
        avatarUrl: userInfo.avatarUrl || ''
      })
    }
  },

  // 选择头像
  onChooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        this.uploadAvatar(tempFilePath)
      }
    })
  },

  // 上传头像（真实上传到服务器，后端会做内容安全检测）
  async uploadAvatar(filePath) {
    try {
      wx.showLoading({ title: '上传中...', mask: true })

      const res = await upload('/mp/user/avatar/upload', filePath, 'file')

      this.setData({
        avatarUrl: res.data.url
      })

      wx.hideLoading()
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      // 违规头像等错误提示由 upload 内部 toast 展示
      console.error('头像上传失败:', error)
    }
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    })
  },

  // 选择性别
  onGenderChange(e) {
    const gender = parseInt(e.detail.value)
    this.setData({ gender })
  },

  // 保存资料
  async onSave() {
    const { nickname, gender, avatarUrl } = this.data
    
    if (!nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    
    try {
      wx.showLoading({ title: '保存中...' })
      
      // 更新昵称
      if (nickname !== this.data.userInfo.nickname) {
        await api.user.updateNickname(nickname.trim())
      }
      
      // 更新性别
      if (gender !== this.data.userInfo.gender) {
        await api.user.updateGender(gender)
      }
      
      // 更新头像（如果有变化）
      if (avatarUrl && avatarUrl !== this.data.userInfo.avatarUrl) {
        await api.user.updateAvatar(avatarUrl)
      }
      
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      
      // 返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      wx.hideLoading()
      // 优先展示后端返回的错误信息（如昵称含违规内容）
      wx.showToast({ title: (error && error.msg) || '保存失败', icon: 'none' })
    }
  }
})