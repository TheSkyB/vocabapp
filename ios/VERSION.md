# 背单词 App - 版本历史

## v1.1.0 (build 2) — 2026-04-22
- 修复：词库选择弹窗在 WKWebView 中无法点击（inline onclick 改为 addEventListener）
- 修复：iPhone 15 Pro 底部导航栏偏上（Swift 注入 safe area insets）
- 修复：Service Worker 缓存列表缺少 ielts_words.js
- 修复：拼写模式 hint() 函数只能点击一次
- 修复：web 资源未打包进 IPA（XcodeGen symlink 问题）
- 新增：WebView.swift safe area 自动适配

## v1.0.0 (build 1) — 2026-04-22
- 初始版本
- CET-4 核心词汇 150 词
- IELTS 核心词汇 3632 词
- 学习模式：卡片、选择、拼写
- 复习、错题本、收藏夹
- 深色模式
- 触感反馈
