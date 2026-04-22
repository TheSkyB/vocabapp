# 部署指南

## 方式一：GitHub Actions 云端构建 IPA

### 步骤 1: 创建 GitHub 仓库

1. 打开 https://github.com/new
2. Repository name: `vocabapp`
3. 选择 Private 或 Public
4. 点击 **Create repository**

### 步骤 2: 上传代码到 GitHub

在 GitHub 仓库页面，点击 **uploading an existing file**，然后：

1. 把 `背单词` 文件夹内的**所有文件**拖进去
2. 包括 `.gitignore`（隐藏文件需要显示后拖入）
3. 点击 **Commit changes**

### 步骤 3: 触发构建

1. 进入仓库 → 点击 **Actions** 标签
2. 点击左侧 **Build IPA**
3. 点击 **Run workflow** → **Run workflow**
4. 等待构建完成（约 5-10 分钟）

### 步骤 4: 下载 IPA

1. 构建成功后，点击构建任务
2. 找到 **Artifacts** 部分
3. 点击 `VocabApp-ipa` 下载

---

## 方式二：本地 Mac 构建

```bash
# 安装 XcodeGen
brew install xcodegen

# 进入 ios 目录并生成项目
cd ios
xcodegen generate

# 构建并导出 IPA
xcodebuild -project VocabApp.xcodeproj \
  -scheme VocabApp \
  -configuration Release \
  -sdk iphoneos \
  -archivePath build/VocabApp.xcarchive \
  archive \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO

# 打包 IPA
mkdir -p build/Payload
cp -r build/VocabApp.xcarchive/Products/Applications/VocabApp.app build/Payload/
cd build && zip -r VocabApp.ipa Payload/
```

---

## 方式三：PWA 安装（最快，无需构建）

iPhone Safari 打开 `web/index.html` → 分享按钮 → **添加到主屏幕**
