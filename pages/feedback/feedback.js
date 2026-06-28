// pages/feedback/feedback.js
const api = require('../../utils/api.js')
const { openLegalPage } = require('../../utils/legal.js')

Page({
  data: {
    // 反馈类型
    feedbackType: 1,
    typeList: [
      { value: 1, label: '功能建议' },
      { value: 2, label: 'BUG反馈' },
      { value: 3, label: '账号问题' },
      { value: 4, label: '其他' }
    ],
    // 表单数据
    title: '',
    content: '',
    contact: '',
    images: [],
    // 隐私协议同意状态
    privacyAgreed: false
  },

  onLoad() {
    // 页面加载
  },

  // 切换隐私协议同意状态
  toggleAgree() {
    this.setData({
      privacyAgreed: !this.data.privacyAgreed
    })
  },

  // 跳转隐私政策
  goPrivacy() {
    openLegalPage('privacy')
  },

  // 跳转用户服务协议
  goAgreement() {
    openLegalPage('agreement')
  },

  // 选择反馈类型
  onTypeSelect(e) {
    this.setData({
      feedbackType: e.currentTarget.dataset.value
    })
  },

  // 输入标题
  onTitleInput(e) {
    this.setData({
      title: e.detail.value
    })
  },

  // 输入内容
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    })
  },

  // 输入联系方式
  onContactInput(e) {
    this.setData({
      contact: e.detail.value
    })
  },

  // 选择图片
  chooseImage() {
    const { images } = this.data
    const remainCount = 3 - images.length
    
    // 使用 wx.chooseMedia (推荐) 或 wx.chooseImage (兼容)
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: remainCount,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const newImages = [...images, ...res.tempFiles.map(file => file.tempFilePath)]
          this.setData({
            images: newImages
          })
        },
        fail: (err) => {
          console.error('选择图片失败:', err)
          wx.showToast({ title: '选择图片失败', icon: 'none' })
        }
      })
    } else {
      // 兼容旧版本
      wx.chooseImage({
        count: remainCount,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const newImages = [...images, ...res.tempFilePaths]
          this.setData({
            images: newImages
          })
        },
        fail: (err) => {
          console.error('选择图片失败:', err)
          wx.showToast({ title: '选择图片失败', icon: 'none' })
        }
      })
    }
  },

  // 预览图片
  previewImage(e) {
    const { url } = e.currentTarget.dataset
    wx.previewImage({
      current: url,
      urls: this.data.images
    })
  },

  // 删除图片
  deleteImage(e) {
    const { index } = e.currentTarget.dataset
    const { images } = this.data
    images.splice(index, 1)
    this.setData({ images })
  },

  // 提交反馈
  async onSubmit() {
    const { feedbackType, title, content, contact, images, privacyAgreed } = this.data

    // 隐私协议验证
    if (!privacyAgreed) {
      wx.showToast({ title: '请先阅读并同意隐私政策和用户服务协议', icon: 'none', duration: 2000 })
      return
    }

    // 表单验证
    if (!title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!content.trim()) {
      wx.showToast({ title: '请输入详细描述', icon: 'none' })
      return
    }

    wx.showLoading({ title: '提交中...', mask: true })

    try {
      // 这里简化处理，实际应该上传图片到服务器
      const imageUrls = images.length > 0 ? JSON.stringify(images) : null

      const res = await api.feedback.submit({
        feedbackType,
        title: title.trim(),
        content: content.trim(),
        contact: contact.trim() || null,
        images: imageUrls
      })

      wx.hideLoading()

      if (res.code === 0) {
        wx.showToast({
          title: '提交成功',
          icon: 'success',
          duration: 2000,
          success: () => {
            setTimeout(() => {
              wx.navigateBack()
            }, 2000)
          }
        })
      } else {
        wx.showToast({ title: res.msg || '提交失败', icon: 'none' })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  }
})
