# VocabApp 一键部署脚本
# 运行此脚本完成 GitHub 上传和 IPA 构建

param(
    [string]$GitHubToken = "",
    [string]$RepoName = "vocabapp"
)

$ErrorActionPreference = "Stop"

Write-Host "=== VocabApp 部署脚本 ===" -ForegroundColor Cyan

# 1. 检查 Git
Write-Host "`n[1/5] 检查 Git..." -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git 未安装，正在下载安装..." -ForegroundColor Red
    Write-Host "请手动安装 Git: https://git-scm.com/download/win"
    Write-Host "安装后重新运行此脚本"
    exit 1
}
$gitVersion = git --version
Write-Host "Git 版本: $gitVersion"

# 2. 检查 GitHub CLI
Write-Host "`n[2/5] 检查 GitHub CLI..." -ForegroundColor Yellow
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "GitHub CLI 未安装，正在下载..." -ForegroundColor Yellow
    
    # 下载 GitHub CLI
    $ghUrl = "https://github.com/cli/cli/releases/download/v2.50.0/gh_2.50.0_windows_amd64.msi"
    $ghInstaller = "$env:TEMP\gh_installer.msi"
    
    Write-Host "下载 GitHub CLI..."
    Invoke-WebRequest -Uri $ghUrl -OutFile $ghInstaller
    
    Write-Host "安装 GitHub CLI..."
    Start-Process msiexec.exe -ArgumentList "/i `"$ghInstaller`" /quiet" -Wait
    
    # 刷新环境变量
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

Write-Host "GitHub CLI 版本: $(gh --version)"

# 3. 登录 GitHub
Write-Host "`n[3/5] GitHub 登录..." -ForegroundColor Yellow
if (-not $GitHubToken) {
    Write-Host "请在浏览器中完成 GitHub 授权..."
    gh auth login --hostname github.com -w
} else {
    Write-Host "使用提供的 Token 登录..."
    gh auth login --with-token <<< $GitHubToken
}

# 4. 创建仓库并上传
Write-Host "`n[4/5] 创建仓库并上传代码..." -ForegroundColor Yellow
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 创建新仓库
Set-Location $projectDir
gh repo create $RepoName --private --source . --push

# 5. 触发构建
Write-Host "`n[5/5] 触发 GitHub Actions 构建..." -ForegroundColor Yellow
Write-Host "等待构建完成（可能需要 5-10 分钟）..."

# 触发 workflow
gh workflow run build.yml

# 等待构建完成
Write-Host "监控构建进度..."
gh run watch

# 下载 IPA
Write-Host "`n下载 IPA 到桌面..." -ForegroundColor Green
$desktop = [Environment]::GetFolderPath("Desktop")
gh run download --dir $desktop

Write-Host "`n=== 部署完成 ===" -ForegroundColor Green
Write-Host "IPA 已下载到桌面: $desktop"
