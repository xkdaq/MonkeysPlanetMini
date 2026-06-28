// pages/profile/bind-phone.js
const { get, post } = require('../../utils/request.js')

Page({
  data: {
    phone: '',
    code: '',
    password: '',
    countdown: 0,
    timer: null,
    isBound: false,  // 是否已绑定
    boundPhone: ''   // 已绑定的手机号
  },

  onLoad() {
    // 获取用户信息，检查是否已绑定手机号
    this.loadUserInfo()
  },

  onUnload() {
    // 清除定时器
    if (this.data.timer) {
      clearInterval(this.data.timer)
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const res = await get('/mp/user/info')
      if (res.code === 0 && res.data) {
        const userInfo = res.data
        if (userInfo.phone) {
          // 已绑定手机号
          this.setData({
            isBound: true,
            boundPhone: userInfo.phone,
            phone: userInfo.phone
          })
        }
      }
    } catch (error) {
      console.error('获取用户信息失败', error)
    }
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    })
  },

  // 输入验证码
  onCodeInput(e) {
    this.setData({
      code: e.detail.value
    })
  },

  // 输入密码
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    })
  },

  // 发送验证码
  async sendCode() {
    const { phone, countdown, isBound } = this.data

    // 如果已绑定，不允许发送验证码
    if (isBound) {
      wx.showToast({ title: '您已绑定手机号，暂不支持修改', icon: 'none' })
      return
    }

    if (countdown > 0) {
      return
    }

    // 校验手机号
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }

    wx.showLoading({ title: '发送中...' })

    try {
      const res = await get('/mp/sms/send', { phone })

      wx.hideLoading()

      if (res.code === 0) {
        wx.showToast({ title: '发送成功', icon: 'success' })
        this.startCountdown()
      } else {
        wx.showToast({ title: res.msg || '发送失败', icon: 'none' })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
  },

  // 开始倒计时
  startCountdown() {
    this.setData({ countdown: 60 })
    const timer = setInterval(() => {
      const { countdown } = this.data
      if (countdown <= 1) {
        clearInterval(timer)
        this.setData({ countdown: 0, timer: null })
      } else {
        this.setData({ countdown: countdown - 1 })
      }
    }, 1000)
    this.setData({ timer })
  },

  // 提交绑定
  async onSubmit() {
    const { phone, code, password, isBound } = this.data

    // 如果已绑定，提示暂不支持修改
    if (isBound) {
      wx.showToast({ title: '您已绑定手机号，暂不支持修改', icon: 'none' })
      return
    }

    // 表单验证
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    if (!code || code.length !== 6) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' })
      return
    }

    // 密码验证（必填）
    if (!password) {
      wx.showToast({ title: '请设置登录密码', icon: 'none' })
      return
    }
    if (password.length < 6) {
      wx.showToast({ title: '密码长度不能少于6位', icon: 'none' })
      return
    }

    wx.showLoading({ title: '绑定中...', mask: true })

    try {
      const res = await post('/mp/phone/bind', {
        phone,
        code,
        password
      })

      wx.hideLoading()

      if (res.code === 0) {
        wx.showToast({
          title: '绑定成功',
          icon: 'success',
          duration: 2000,
          success: () => {
            setTimeout(() => {
              wx.navigateBack()
            }, 2000)
          }
        })
      } else {
        wx.showToast({ title: res.msg || '绑定失败', icon: 'none' })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '绑定失败', icon: 'none' })
    }
  }
})
