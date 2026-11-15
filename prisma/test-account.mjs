/**
 * 永久测试账号
 *
 * 与演示数据分离：即使关闭 SEED_DEMO_DATA，Docker 启动时也会单独确保该账号存在。
 * 账号用于评审与自动化验收，不会随演示数据开关被跳过。
 */
import bcrypt from "bcryptjs";

export const TEST_ACCOUNT = {
  id: "test-user",
  username: "test",
  nickname: "测试账号",
  password: "test1234",
};

/**
 * 确保测试账号存在（幂等）
 * @returns 是否新建
 */
export async function ensureTestAccount(prisma) {
  const existing = await prisma.user.findUnique({
    where: { username: TEST_ACCOUNT.username },
    select: { id: true },
  });
  if (existing) return false;

  const password = await bcrypt.hash(TEST_ACCOUNT.password, 10);
  await prisma.user.create({
    data: {
      id: TEST_ACCOUNT.id,
      username: TEST_ACCOUNT.username,
      nickname: TEST_ACCOUNT.nickname,
      password,
    },
  });
  return true;
}
