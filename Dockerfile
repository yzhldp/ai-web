# ===== 构建阶段 =====
FROM node:20-alpine AS base
# 国内构建加速：Alpine 源、npm 源与 Prisma 引擎镜像均可通过构建参数覆盖
ARG APK_MIRROR=https://mirrors.aliyun.com/alpine
RUN sed -i "s#https://dl-cdn.alpinelinux.org/alpine#${APK_MIRROR}#g" /etc/apk/repositories \
  && apk add --no-cache openssl su-exec
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com \
    PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

# 依赖安装阶段
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
# 先复制 Prisma Schema，便于安装后生成客户端与查询引擎
COPY prisma ./prisma
# 复用 pnpm 存储缓存，重复构建无需重新下载依赖
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --prefer-offline
RUN pnpm exec prisma generate

# 构建阶段
FROM base AS builder
WORKDIR /app
# Prisma Client 在构建期初始化时需要可用的连接串占位（不会真正连接数据库）
ENV DATABASE_URL="file:/tmp/build.db"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 复用 Next.js 编译缓存，二次构建更快
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache pnpm build

# ===== 运行阶段 =====
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data \
    DATABASE_URL=file:/app/data/prod.db \
    TZ=Asia/Shanghai

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/prisma ./prisma

# 数据目录交给非 root 用户，配合 volume 持久化 SQLite
RUN mkdir -p /app/data && chown -R node:node /app/data /app/.next
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
# Windows 检出可能带入 CRLF，统一转为 LF 后再赋权，避免 shebang 解析失败
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod 755 /app/docker-entrypoint.sh

EXPOSE 3000

# 健康检查：容器编排平台据此判断服务与数据库是否就绪
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

# 启动脚本先修正挂载卷权限，再降权到 node 用户执行数据库同步与服务启动
ENTRYPOINT ["/app/docker-entrypoint.sh"]
