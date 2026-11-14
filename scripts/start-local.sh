#!/bin/sh
# 无需 Docker：一键本地运行（macOS / Linux）
# 用法：sh scripts/start-local.sh

set -eu
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js，请先安装 Node.js 20 LTS：https://nodejs.org/zh-cn"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "[错误] Node.js 版本过低（$NODE_VERSION），需要 18.17 以上，推荐 20 LTS"
  exit 1
fi
echo "[1/4] Node.js $NODE_VERSION 检查通过"

if [ ! -f .env ]; then
  cp .env.example .env
fi
if grep -q '^JWT_SECRET="please-change-me' .env 2>/dev/null || ! grep -q '^JWT_SECRET=' .env; then
  SECRET=$(openssl rand -base64 48 2>/dev/null || node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
  sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=\"$SECRET\"|" .env && rm -f .env.bak
  echo "      已生成随机 JWT_SECRET"
fi
if ! grep -q '^DEEPSEEK_API_KEY="[^"]' .env; then
  echo "      [提示] 未填写模型密钥，AI 生成不可用；悬浮助手离线问答仍可使用"
fi

export COREPACK_NPM_REGISTRY="https://registry.npmmirror.com"
echo "[2/4] 安装依赖（首次约 2-4 分钟）..."
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@10.5.2 --activate >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

echo "[3/4] 初始化数据库与构建..."
pnpm exec prisma db push
pnpm build

echo "[4/4] 启动服务： http://localhost:3000  （Ctrl+C 停止）"
PORT=3000 pnpm start
