// pages/profile/change-password.js
const { post } = require('../../utils/request.js')

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  },

  // 输入旧密码
  onOldPasswordInput(e) {
    this.setData({
      oldPassword: e.detail.value
    })
  },

  // 输入新密码
  onNewPasswordInput(e) {
    this.setData({
      newPassword: e.detail.value
    })
  },

  // 输入确认密码
  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value
    })
  },

  // 提交修改
  async onSubmit() {
    const { oldPassword, newPassword, confirmPassword } = this.data

    // 表单验证
    if (!oldPassword) {
      wx.showToast({ title: '请输入旧密码', icon: 'none' })
      return
    }

    if (!newPassword || newPassword.length < 6) {
      wx.showToast({ title: '新密码长度不能少于6位', icon: 'none' })
      return
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次输入的新密码不一致', icon: 'none' })
      return
    }

    wx.showLoading({ title: '修改中...', mask: true })

    try {
      const res = await post('/mp/phone/change-password', {
        oldPassword,
        newPassword
      })

      wx.hideLoading()

      if (res.code === 0) {
        wx.showToast({
          title: '修改成功',
          icon: 'success',
          duration: 2000,
          success: () => {
            setTimeout(() => {
              wx.navigateBack()
            }, 2000)
          }
        })
      } else {
        wx.showToast({ title: res.msg || '修改失败', icon: 'none' })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '修改失败', icon: 'none' })
    }
  }
})
