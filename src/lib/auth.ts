import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/** Cookie 名称，用于存储 JWT */
export const AUTH_COOKIE = "auth_token";

/** JWT 有效期：7 天 */
const JWT_EXPIRES = "7d";

/**
 * 获取 JWT 签名密钥
 * 通过 TextEncoder 将字符串密钥转换为 jose 所需的 Uint8Array
 */
function getSecretKey() {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

/**
 * 生成 JWT token
 * @param payload 需要编码进 token 的数据
 */
export async function signToken(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES)
    .sign(getSecretKey());
}

/**
 * 校验并解析 JWT token
 * @returns 解析后的 payload，失败返回 null
 */
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}

/**
 * 从 HttpOnly Cookie 中读取当前登录用户信息
 * @returns 用户对象（不含密码），未登录返回 null
 */
export async function getCurrentUser() {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.uid) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.uid as string },
    select: {
      id: true,
      username: true,
      nickname: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}
