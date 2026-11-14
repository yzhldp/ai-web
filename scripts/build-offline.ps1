# 生成「零安装」离线运行包（Windows x64）
# 产物：dist-offline/ai-web-offline-win-x64.zip
# 评委解压后双击「启动.bat」即可运行，无需安装 Node.js 或 Docker。
# 用法：powershell -ExecutionPolicy Bypass -File scripts/build-offline.ps1

param(
  [string]$NodeVersion = "20.18.0"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$distDir = Join-Path $root "dist-offline"
$stage = Join-Path $distDir "ai-web-offline-win-x64"
$cacheDir = Join-Path $root ".cache"
$nodeDir = Join-Path $cacheDir "node-v$NodeVersion-win-x64"
$nodeZip = Join-Path $cacheDir "node-v$NodeVersion-win-x64.zip"

New-Item -ItemType Directory -Force -Path $distDir, $cacheDir | Out-Null

# 1. 准备便携版 Node
if (-not (Test-Path (Join-Path $nodeDir "node.exe"))) {
  Write-Host "[1/6] 下载便携版 Node.js v$NodeVersion ..." -ForegroundColor Cyan
  Invoke-WebRequest "https://npmmirror.com/mirrors/node/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -OutFile $nodeZip -TimeoutSec 600
  Expand-Archive $nodeZip -DestinationPath $cacheDir -Force
}
$nodeExe = Join-Path $nodeDir "node.exe"
$npmCmd = Join-Path $nodeDir "npm.cmd"
$env:Path = "$nodeDir;$env:Path"
Write-Host "      Node: $(& $nodeExe -v)" -ForegroundColor Green

# 2. 清理并复制源码
Write-Host "[2/6] 准备打包目录 ..." -ForegroundColor Cyan
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$items = @("package.json", "pnpm-lock.yaml", ".npmrc", "next.config.mjs", "tsconfig.json",
           "postcss.config.mjs", "tailwind.config.ts", "components.json", "public", "prisma", "src", ".env.example")
foreach ($item in $items) {
  if (Test-Path $item) { Copy-Item $item (Join-Path $stage $item) -Recurse -Force }
}
Remove-Item (Join-Path $stage "prisma\*.db") -Force -ErrorAction SilentlyContinue

# 3. 安装依赖并构建
Write-Host "[3/6] 安装依赖（国内镜像）..." -ForegroundColor Cyan
Push-Location $stage
$env:COREPACK_NPM_REGISTRY = "https://registry.npmmirror.com"
$env:PRISMA_ENGINES_MIRROR = "https://registry.npmmirror.com/-/binary/prisma"
& $npmCmd install -g pnpm@10.5.2 --registry=https://registry.npmmirror.com --no-audit --no-fund | Out-Null
& pnpm install --frozen-lockfile --node-linker=hoisted --ignore-scripts
& pnpm exec prisma generate

Write-Host "[4/6] 生产构建 ..." -ForegroundColor Cyan
# 构建期 Prisma Client 初始化需要连接串占位（不会真正写入）
$env:DATABASE_URL = "file:" + (Join-Path $stage "build.db").Replace("\", "/")
& pnpm build
if ($LASTEXITCODE -ne 0) { throw "构建失败" }

# 4. 预生成 SQLite 数据库，运行期无需 Prisma CLI
New-Item -ItemType Directory -Force -Path (Join-Path $stage "data") | Out-Null
$dbPath = (Join-Path $stage "data\dev.db").Replace("\", "/")
$env:DATABASE_URL = "file:$dbPath"
& pnpm exec prisma db push --skip-generate
Pop-Location

# 5. 精简为生产依赖、清理中间产物并组装便携 Node
Write-Host "[5/6] 精简与组装运行包 ..." -ForegroundColor Cyan
Push-Location $stage
$prismaBackup = Join-Path $distDir "prisma-client-backup"
Remove-Item $prismaBackup -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $stage "node_modules\.prisma") $prismaBackup -Recurse -Force -ErrorAction SilentlyContinue
& pnpm install --prod --frozen-lockfile --node-linker=hoisted --ignore-scripts
if (-not (Test-Path (Join-Path $stage "node_modules\.prisma\client\index.js"))) {
  Copy-Item $prismaBackup (Join-Path $stage "node_modules\.prisma") -Recurse -Force
}
Pop-Location
Remove-Item $prismaBackup -Recurse -Force -ErrorAction SilentlyContinue

foreach ($item in @(".next\cache", "src", "tsconfig.json", "tailwind.config.ts", "postcss.config.mjs",
                    ".npmrc", "pnpm-lock.yaml", "components.json", "next-env.d.ts")) {
  Remove-Item (Join-Path $stage $item) -Recurse -Force -ErrorAction SilentlyContinue
}

$runtimeNode = Join-Path $stage "runtime\node"
New-Item -ItemType Directory -Force -Path $runtimeNode | Out-Null
Copy-Item (Join-Path $nodeDir "*") $runtimeNode -Recurse -Force
foreach ($extra in @("npm", "npm.cmd", "npx", "npx.cmd", "corepack", "corepack.cmd",
                     "node_modules\npm", "node_modules\corepack")) {
  Remove-Item (Join-Path $runtimeNode $extra) -Recurse -Force -ErrorAction SilentlyContinue
}

$bat = @'
@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist ".env" copy ".env.example" ".env" >nul

for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Location).Path.Replace('\','/')"') do set "BASE=%%i"
set "DATABASE_URL=file:%BASE%/data/dev.db"
set "NODE_ENV=production"
set "PORT=3000"
set "PATH=%~dp0runtime\node;%PATH%"

echo ============================================
echo   创意雏形合成助手 已启动
echo   浏览器访问: http://localhost:3000
echo   关闭本窗口即可停止服务
echo ============================================
start "" http://localhost:3000
"%~dp0runtime\node\node.exe" "%~dp0node_modules\next\dist\bin\next" start -p 3000
pause
'@
Set-Content -Path (Join-Path $stage "启动.bat") -Value $bat -Encoding Default

$readme = @'
创意雏形合成助手 · 离线运行包（Windows x64）

使用步骤：
1. 解压本压缩包到任意目录（路径不要含中文和空格，例如 D:\ai-web）
2. 双击「启动.bat」
3. 浏览器自动打开 http://localhost:3000
4. 首次使用请先注册账号（密码 8-20 位，不能是纯数字）

说明：
- 内置 Node.js 与全部依赖，无需安装 Docker / Node.js，无需联网即可打开页面；
- AI 在线生成需要联网并配置模型密钥：编辑 .env 填写 DEEPSEEK_API_KEY 后重启；
- 未配置密钥时，悬浮助手的离线问答、知识库与页面功能仍可使用；
- 数据保存在 data\dev.db，删除该文件即可重置全部账号与方案。
'@
Set-Content -Path (Join-Path $stage "使用说明.txt") -Value $readme -Encoding UTF8

# 6. 压缩（使用系统自带 tar，比 Compress-Archive 更快更稳）
Write-Host "[6/6] 压缩离线包（约 1-2 分钟）..." -ForegroundColor Cyan
$zipPath = Join-Path $distDir "ai-web-offline-win-x64.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
& tar.exe -a -c -f $zipPath -C $stage .
if ($LASTEXITCODE -ne 0) { throw "压缩失败" }

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "完成：$zipPath （$sizeMB MB）" -ForegroundColor Green
