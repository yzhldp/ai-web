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

echo "[entrypoint] 启动 Next.js 服务 (port=${PORT:-3000})..."
exec npx next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
