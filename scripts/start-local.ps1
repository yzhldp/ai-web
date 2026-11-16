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
$providerKeys = @(
  "DEEPSEEK_API_KEY", "DASHSCOPE_API_KEY", "ZHIPU_API_KEY", "MOONSHOT_API_KEY",
  "DOUBAO_API_KEY", "QIANFAN_API_KEY", "HUNYUAN_API_KEY", "SPARK_API_KEY",
  "MINIMAX_API_KEY", "STEPFUN_API_KEY", "YI_API_KEY", "BAICHUAN_API_KEY",
  "SENSENOVA_API_KEY", "SILICONFLOW_API_KEY", "CUSTOM_API_KEY", "OLLAMA_BASE_URL"
)
$hasModelConfig = $false
foreach ($key in $providerKeys) {
  if (Get-EnvValue $key) { $hasModelConfig = $true; break }
}
if (-not $hasModelConfig) {
  Write-Host "      [提示] 未填写模型密钥，AI 生成不可用；悬浮助手离线问答仍可使用" -ForegroundColor Yellow
}

# 3. 安装依赖并初始化数据库
# 直接使用 npx 调用指定版本 pnpm，避免 corepack 在国内镜像下的签名校验失败
$env:npm_config_registry = "https://registry.npmmirror.com"
$env:PRISMA_ENGINES_MIRROR = "https://registry.npmmirror.com/-/binary/prisma"
Write-Host "[2/4] 安装依赖（使用国内镜像，首次约 2-4 分钟）..." -ForegroundColor Cyan
# --ignore-scripts 规避 pnpm 10 的构建脚本批准机制，随后显式生成 Prisma Client
& npx --yes pnpm@10.5.2 install --frozen-lockfile --ignore-scripts --node-linker=hoisted
if ($LASTEXITCODE -ne 0) { throw "依赖安装失败，请检查网络后重试" }
& npx --yes pnpm@10.5.2 exec prisma generate
if ($LASTEXITCODE -ne 0) { throw "Prisma Client 生成失败" }

Write-Host "[3/4] 初始化数据库、测试账号与构建..." -ForegroundColor Cyan
& npx --yes pnpm@10.5.2 exec prisma db push
if ((Get-EnvValue "SEED_DEMO_DATA") -ne "false") {
  & node prisma/seed.mjs
} else {
  & node prisma/ensure-test-account.mjs
}
if ($LASTEXITCODE -ne 0) { throw "测试账号初始化失败" }
& npx --yes pnpm@10.5.2 build
if ($LASTEXITCODE -ne 0) { throw "构建失败" }

# 4. 启动
Write-Host "[4/4] 启动服务： http://localhost:3000" -ForegroundColor Green
Write-Host "      按 Ctrl+C 停止" -ForegroundColor DarkGray
$env:PORT = "3000"
& npx --yes pnpm@10.5.2 start
