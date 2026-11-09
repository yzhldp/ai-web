import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client 单例
 * 避免在 Next.js 开发模式下因热更新产生多个数据库连接实例
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
