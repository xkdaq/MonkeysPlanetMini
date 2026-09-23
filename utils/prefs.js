// utils/prefs.js
// 用户偏好的统一读写口。
//
// 为什么单独抽一层：这些偏好要被「设置页」和「功能页」两边读写，
// 而且历史上有的偏好是塞在功能页自己的存档对象里的（比如连连看的
// vibrate/reveal 就写在 edu_pair_v1 里），两边各写各的会读不到对方。
// 统一到独立 key + 一处读写，两边才能真正同步。
//
// 存储格式：布尔一律存 '1'/'0' 字符串，与既有的 edu_wheel_no_repeat 保持一致
// （wheel.js 用 === '1' 判定，不能改成布尔量）。

const KEYS = {
  // 刷题
  practiceMode: 'pref_practice_mode',   // 'answer' | 'study'
  autoResume: 'pref_auto_resume',       // '1' | '0'
  // 连连看
  vibrate: 'pref_vibrate',              // '1' | '0'
  pairReveal: 'pref_pair_reveal',       // '1' | '0'
  // 大转盘（沿用既有 key，不新建）
  wheelNoRepeat: 'edu_wheel_no_repeat'  // '1' | '0'
}

const DEFAULTS = {
  practiceMode: 'answer',
  autoResume: false,
  vibrate: true,
  pairReveal: false,
  wheelNoRepeat: false
}

function readRaw(key) {
  try {
    return wx.getStorageSync(key)
  } catch (e) {
    return ''
  }
}

/**
 * 读布尔偏好。注意 getStorageSync 在 key 不存在时返回 ''，
 * 不能直接当 false 用——否则默认值为 true 的偏好（如振动）会被强制成关。
 */
function getBool(name) {
  const raw = readRaw(KEYS[name])
  if (raw === '1') return true
  if (raw === '0') return false
  return DEFAULTS[name]
}

function setBool(name, value) {
  try {
    wx.setStorageSync(KEYS[name], value ? '1' : '0')
  } catch (e) { /* 存不下就维持内存值 */ }
}

function getPracticeMode() {
  const raw = readRaw(KEYS.practiceMode)
  return raw === 'study' || raw === 'answer' ? raw : DEFAULTS.practiceMode
}

function setPracticeMode(mode) {
  try {
    wx.setStorageSync(KEYS.practiceMode, mode === 'study' ? 'study' : 'answer')
  } catch (e) { /* 忽略 */ }
}

/**
 * 一次性迁移：把旧版塞在功能页存档里的偏好搬到独立 key。
 * 只在独立 key 还不存在时才搬，搬完不再回头读旧字段；
 * 不做的话老用户升级后既有选择会全部回落默认值。
 * @param {string} name 偏好名
 * @param {*} legacyValue 旧存档里的值（undefined 表示旧档也没有）
 */
function migrateBoolOnce(name, legacyValue) {
  const raw = readRaw(KEYS[name])
  if (raw === '1' || raw === '0') return getBool(name)   // 已迁移过
  if (typeof legacyValue === 'boolean') {
    setBool(name, legacyValue)
    return legacyValue
  }
  return DEFAULTS[name]
}

module.exports = {
  KEYS,
  DEFAULTS,
  getBool,
  setBool,
  getPracticeMode,
  setPracticeMode,
  migrateBoolOnce
}
