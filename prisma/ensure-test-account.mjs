/**
 * 独立确保永久测试账号存在
 * 运行方式：node prisma/ensure-test-account.mjs
 */
import { PrismaClient } from "@prisma/client";
import { TEST_ACCOUNT, ensureTestAccount } from "./test-account.mjs";

const prisma = new PrismaClient();

async function main() {
  const created = await ensureTestAccount(prisma);
  console.log(
    `[test-account] ${created ? "已创建" : "已存在"}：${TEST_ACCOUNT.username} / ${TEST_ACCOUNT.password}`
  );
}

main()
  .catch((error) => {
    console.error("[test-account] 初始化失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
