# 📖 背单词 - 艾宾浩斯智能背单词应用

基于艾宾浩斯遗忘曲线的 iOS 背单词应用，支持多种学习模式、智能复习调度、离线使用。

## 功能特性

### 🎯 核心学习
- **卡片模式** — 逐词浏览，翻转查看释义，标记掌握程度
- **选择题** — 看词选义，四选一
- **反向选择** — 看义选词
- **拼写模式** — 根据释义拼写单词，支持字母提示

### 📚 词库
- 内置 CET-4 核心词汇（150词）
- 支持搜索浏览
- 可扩展更多词库

### 🔄 复习强化
- **艾宾浩斯遗忘曲线** 自动安排复习时间
- 五级间隔：5分钟→30分钟→12小时→1天→2天→4天→7天→15天→30天
- 错题本自动收集
- 收藏夹重点标记
- 学习统计报告

### ⚙️ 个性化设置
- 每日新词目标（10/20/30/50）
- 复习提醒时间
- 深色模式
- 美式/英式发音
- 自动播放发音
- 数据导入/导出

## 项目结构

```
背单词/
├── web/                      # Web 应用（PWA）
│   ├── index.html            # 主页面
│   ├── manifest.json         # PWA 配置
│   ├── sw.js                 # Service Worker
│   ├── css/style.css         # 样式
│   └── js/
│       ├── words.js          # 词库数据
│       ├── db.js             # IndexedDB 数据层
│       └── app.js            # 应用逻辑
├── ios/                      # iOS 原生包装
│   ├── project.yml           # XcodeGen 项目配置
│   └── VocabApp/
│       ├── App.swift         # 入口
│       ├── WebView.swift     # WKWebView 包装
│       └── Info.plist        # 应用配置
└── .github/workflows/
    └── build.yml             # GitHub Actions 构建 IPA
```

## 快速体验（浏览器）

1. 进入 `web/` 目录
2. 启动本地服务器：
   ```bash
   # Python
   python -m http.server 8080
   
   # Node.js
   npx serve .
   ```
3. 浏览器打开 `http://localhost:8080`

## iPhone 安装方式

### 方式一：PWA 添加到主屏幕（最快）

1. iPhone Safari 打开网页版
2. 点击底部「分享」按钮 → 「添加到主屏幕」
3. 桌面出现 App 图标，离线可用

### 方式二：侧载 .ipa 文件

#### 步骤1：GitHub Actions 云端构建

1. 将本项目推送到 GitHub 仓库
2. 进入仓库 → Actions → Build IPA → Run workflow
3. 等待构建完成（约5-10分钟）
4. 下载 `VocabApp-ipa` 产物

#### 步骤2：侧载到 iPhone

选择以下任一工具：

**AltStore**（推荐）
1. 电脑安装 [AltStore](https://altstore.io)
2. iPhone 连接电脑，AltStore 侧载 .ipa
3. 每7天需重新签名（自动续签）

**Sideloadly**
1. 电脑安装 [Sideloadly](https://sideloadly.io)
2. Apple ID 登录，拖入 .ipa 安装

**TrollStore**（iOS 14.0-16.6.1 永久签名）
1. 安装 TrollStore
2. 直接安装 .ipa，无需重签

> ⚠️ 侧载需要 Apple ID（免费开发者账号即可），7天有效期，到期需重签。

## 技术栈

- **前端**：HTML5 + CSS3 + Vanilla JS
- **存储**：IndexedDB（离线优先）
- **发音**：Web Speech API
- **PWA**：Service Worker + Web App Manifest
- **iOS**：SwiftUI + WKWebView
- **构建**：XcodeGen + GitHub Actions

## 开发

无需安装任何框架，纯 HTML/CSS/JS 项目。

```bash
# 本地开发
cd web
python -m http.server 8080

# 构建IPA（需macOS或使用GitHub Actions）
cd ios
xcodegen generate
xcodebuild -project VocabApp.xcodeproj -scheme VocabApp -configuration Release -sdk iphoneos archive ...
```

## License

MIT
