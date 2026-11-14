# 无需 Docker：一键本地运行（Windows PowerShell）
# 用法：右键「使用 PowerShell 运行」，或在仓库根目录执行  powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Get-EnvValue($key) {
  if (-not (Test-Path .env)) { return "" }
  $line = Get-Content .env | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -split "=", 2)[1].Trim().Trim('"')
}

# 1. 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[错误] 未检测到 Node.js，请先安装 Node.js 20 LTS：https://nodejs.org/zh-cn" -ForegroundColor Red
  exit 1
}
$nodeVersion = (node -v).TrimStart("v")
$major = [int]($nodeVersion -split "\.")[0]
if ($major -lt 18) {
  Write-Host "[错误] Node.js 版本过低（$nodeVersion），需要 18.17 以上，推荐 20 LTS" -ForegroundColor Red
  exit 1
}
Write-Host "[1/4] Node.js $nodeVersion 检查通过" -ForegroundColor Green

# 2. 准备环境变量文件
if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}
if ((Get-EnvValue "JWT_SECRET") -eq "please-change-me-to-a-random-secret" -or -not (Get-EnvValue "JWT_SECRET")) {
  $bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes)
  (Get-Content .env) -replace '^JWT_SECRET=.*', "JWT_SECRET=`"$secret`"" | Set-Content .env -Encoding UTF8
  Write-Host "      已生成随机 JWT_SECRET" -ForegroundColor Green
}
if (-not (Get-EnvValue "DEEPSEEK_API_KEY")) {
  Write-Host "      [提示] 未填写模型密钥，AI 生成不可用；悬浮助手离线问答仍可使用" -ForegroundColor Yellow
}

# 3. 安装依赖并初始化数据库
$env:COREPACK_NPM_REGISTRY = "https://registry.npmmirror.com"
Write-Host "[2/4] 安装依赖（使用国内镜像，首次约 2-4 分钟）..." -ForegroundColor Cyan
corepack enable | Out-Null
corepack prepare pnpm@10.5.2 --activate | Out-Null
pnpm install --frozen-lockfile

Write-Host "[3/4] 初始化数据库与构建..." -ForegroundColor Cyan
pnpm exec prisma db push
pnpm build

# 4. 启动
Write-Host "[4/4] 启动服务： http://localhost:3000" -ForegroundColor Green
Write-Host "      按 Ctrl+C 停止" -ForegroundColor DarkGray
$env:PORT = "3000"
pnpm start
