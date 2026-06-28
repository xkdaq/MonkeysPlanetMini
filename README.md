# 猴哥星球 - 微信小程序

一款面向考研/考证场景的教育小程序，集题库刷题、学习资料管理、文章资讯于一体。

## 功能概览

| 模块 | 说明 |
|------|------|
| **📚 题库系统** | 选择题库 → 按分类层级（科目-章-节）→ 顺序/随机/专项练习 |
| **✏️ 刷题引擎** | 答题/背题双模式、答题卡导航、进度自动恢复、计时统计 |
| **📝 错题本** | 自动记录错题，按分类分组，支持移除与专项练习 |
| **⭐ 收藏本** | 收藏/取消收藏题目，按分类分组管理 |
| **📖 文章资讯** | 文章列表浏览，支持搜索（每日查看上限 10 次） |
| **☁️ 网盘资料** | 百度网盘/夸克网盘资源管理，按科目与分类筛选 |
| **📈 学习记录** | 练习次数、题量、正确率、用时统计追踪 |
| **🔐 用户系统** | 微信登录 + 手机号绑定 + 密码管理 |
| **📺 广告变现** | 微信激励视频广告，付费资源需观看完整广告解锁 |

## 项目结构

```
MonkeysPlanetMini/
├── app.js                # 小程序入口（全局数据、登录态管理）
├── app.json              # 全局配置（页面注册、tabBar、窗口样式）
├── app.wxss              # 全局样式
├── project.config.json   # 项目配置
├── .gitignore            # Git 忽略规则
│
├── pages/                # 页面（4 个 Tab + 16 个子页面）
│   ├── index/            # 首页（轮播、公告、文章、网盘预览）
│   ├── wangpan/          # 资料（网盘资源，按科目/分类筛选）
│   ├── exam/             # 题库（选择题库、分类树、练习入口）
│   ├── profile/          # 我的（个人中心、设置、记录等）
│   ├── practice/         # 刷题（答题/背题、答题卡、进度恢复）
│   ├── wrong/            # 错题本
│   ├── favorite/         # 收藏本
│   ├── result/           # 练习结果报告
│   ├── detail/           # 文章/资料详情
│   ├── article-list/     # 文章列表
│   ├── pan-list/         # 资料列表
│   ├── search/           # 全局搜索
│   ├── webview/          # 通用内嵌网页
│   ├── setting/          # 设置（版本信息等）
│   └── feedback/         # 问题反馈
│
├── components/           # 自定义组件
│   └── privacy-modal/    # 隐私授权弹窗
│
├── utils/                # 工具模块
│   ├── config.js         # 🔑 接口加密密钥与配置（已被 .gitignore 忽略）
│   ├── request.js        # 通用 HTTP 请求封装（签名 + 解密）
│   ├── crypto.js         # AES 加解密 + MD5 签名工具
│   ├── article-api.js    # 文章/网盘/首页 API（独立加密体系）
│   ├── material-api.js   # 网盘资料 API（独立加密体系）
│   ├── api.js            # 统一 API 接口管理
│   ├── crypto-js.min.js  # CryptoJS 内联副本
│   └── viewLimit.js      # 每日查看次数限制
│
├── images/               # 图标与品牌素材
├── styles/               # 通用样式
├── miniprogram_npm/      # npm 依赖
│   ├── crypto-js/        # AES/MD5 加解密库
│   └── mp-html/          # 富文本 HTML 渲染组件
│
└── .workbuddy/           # WorkBuddy 工作记忆
```

## 技术栈

| 维度 | 说明 |
|------|------|
| 框架 | 原生微信小程序（非 UniApp / Taro） |
| SDK | 3.15.0 |
| 语言 | JavaScript + WXML + WXSS |
| 状态管理 | `app.globalData` + `wx.getStorageSync` |
| 页面数 | 20 个（4 个 Tab 主页面 + 16 个子页面） |
| 组件 | 1 个自定义组件（隐私授权弹窗） |
| npm 依赖 | `crypto-js`（加解密）、`mp-html`（富文本渲染） |
| 广告 | 微信激励视频广告（2 个广告位） |

## 快速开始

### 1. 环境要求

- 微信开发者工具（稳定版）
- 微信小程序 AppID：`wxe660d62d3d9d3a00`

### 2. 安装依赖

```bash
# 安装 npm 依赖
npm init -y
npm install crypto-js mp-html

# 构建 npm（在微信开发者工具中：工具 → 构建 npm）
```

### 3. 配置密钥

项目使用 AES-128-CBC 对接口数据进行加密。首次拉取代码后，需要创建配置文件：

```bash
# 复制配置文件模板（如果存在版本差异，需向团队成员获取）
cp utils/config.example.js utils/config.js
```

> ⚠️ `utils/config.js` 已被 `.gitignore` 忽略，不会提交到版本库。
> 注意项目中使用了两套不同的 AES 初始向量（IV），请确保配置正确。

### 4. 运行

在微信开发者工具中打开项目根目录，使用「预览」或「真机调试」运行。

## 接口安全

项目使用两套加密通信方案：

### 方案 A：通用 API（用户/题库/练习/收藏/错题等）
- 请求头携带 `Authorization`、`X-Timestamp`、`X-Sign`
- 签名算法：`MD5(SIGN_KEY + timestamp + path)`
- 响应解密：当 `encrypted === true` 时，对 `data` 字段 AES-CBC 解密

### 方案 B：文章/网盘/首页 API
- 始终使用 POST 请求
- 请求头携带 `x-version`
- 响应始终为 AES-CBC 加密的 Base64 字符串

## 后端

后端地址：`https://api.monkeysxu.top`

项目名 `ruoyi-miniprogram`，推测后端基于 [RuoYi](https://gitee.com/y_project/RuoYi)（若依框架）。

## 版权

© 2026 猴哥星球 版权所有

联系方式：monkeys.xu@qq.com
