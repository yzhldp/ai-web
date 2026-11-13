import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken, AUTH_COOKIE } from "@/lib/auth";
import { rateLimit, getClientIp, isHttpsRequest } from "@/lib/rate-limit";

/** 同一 IP 每小时最多注册次数，防止批量注册 */
const REGISTER_LIMIT_PER_HOUR = 5;

/**
 * 注册接口
 * 校验账号（1-20位）与密码（8-20位，非纯数字），校验账号全局唯一
 * 成功后使用 bcryptjs 加密密码，签发 JWT 并写入 HttpOnly Cookie
 */
export async function POST(request: Request) {
  try {
    // 注册频次限制：注册即消耗 AI 额度，必须防刷
    const limited = rateLimit(
      `register:${getClientIp(request)}`,
      REGISTER_LIMIT_PER_HOUR,
      60 * 60 * 1000
    );
    if (!limited.ok) {
      return NextResponse.json(
        { error: "注册过于频繁，请稍后再试" },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    const { username, password } = await request.json();

    // 基础字段校验
    if (!username || !password) {
      return NextResponse.json({ error: "账号和密码不能为空" }, { status: 400 });
    }

    // 账号 1-20 位字符
    if (username.length < 1 || username.length > 20) {
      return NextResponse.json(
        { error: "账号长度需在 1-20 位之间" },
        { status: 400 }
      );
    }

    // 密码 8-20 位字符，且不能为纯数字
    if (password.length < 8 || password.length > 20) {
      return NextResponse.json(
        { error: "密码长度需在 8-20 位之间" },
        { status: 400 }
      );
    }
    if (/^\d+$/.test(password)) {
      return NextResponse.json(
        { error: "密码不能为纯数字" },
        { status: 400 }
      );
    }

    // 校验账号全局唯一
    const existing = await prisma.user.findUnique({
      where: { username },
    });
    if (existing) {
      return NextResponse.json(
        { error: "该账号已被注册，请更换账号" },
        { status: 409 }
      );
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    // 签发 JWT
    const token = await signToken({ uid: user.id, username: user.username });

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, nickname: user.nickname },
    });

    // 写入 HttpOnly Cookie（7 天有效期）
    // 仅在 HTTPS 下标记 Secure，否则内网 http 访问时浏览器会丢弃 Cookie
    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: isHttpsRequest(request),
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("注册失败:", error);
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
