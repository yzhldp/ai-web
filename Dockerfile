# ===== 构建阶段 =====
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

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

EXPOSE 3000

# 启动时先同步数据库，再启动服务
CMD ["sh", "-c", "npx prisma db push --skip-generate && pnpm start"]
