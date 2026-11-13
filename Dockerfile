# ===== 构建阶段 =====
FROM node:20-alpine AS base
# Prisma 需要 OpenSSL 才能正确识别运行时平台并加载查询引擎
# su-exec 用于启动时修正数据目录权限后降权运行
RUN apk add --no-cache openssl su-exec \
  && corepack enable && corepack prepare pnpm@9 --activate

# 依赖安装阶段
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# 忽略构建脚本，后续显式执行 prisma generate
RUN pnpm install --frozen-lockfile --ignore-scripts

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 显式生成 Prisma Client 并执行生产构建
RUN npx prisma generate && pnpm build

# ===== 运行阶段 =====
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/prisma ./prisma

# 数据目录交给非 root 用户，配合 volume 持久化 SQLite
RUN mkdir -p /app/data && chown -R node:node /app/data /app/.next
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod 755 /app/docker-entrypoint.sh

EXPOSE 3000

# 启动脚本会先修正挂载卷权限，再降权到 node 用户执行数据库同步与服务启动
ENTRYPOINT ["/app/docker-entrypoint.sh"]
