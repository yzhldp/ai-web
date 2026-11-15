#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"

# 云平台挂载的数据卷通常属于 root，先修正权限再降权到 node 用户运行
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec su-exec node "$0" "$@"
fi

echo "[entrypoint] 同步数据库表结构..."
npx prisma db push --skip-generate

# 永久测试账号：与演示数据开关无关，始终确保存在
echo "[entrypoint] 确保永久测试账号..."
node prisma/ensure-test-account.mjs || echo "[entrypoint] 测试账号初始化失败，已跳过"

# 初始化演示社区数据（演示用户 / 公开项目 / 评论），可重复执行
if [ "${SEED_DEMO_DATA:-true}" != "false" ]; then
  echo "[entrypoint] 初始化演示社区数据..."
  node prisma/seed.mjs || echo "[entrypoint] 演示数据初始化失败，已跳过"
fi

echo "[entrypoint] 启动 Next.js 服务 (port=${PORT:-3000})..."
exec npx next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
