import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken, AUTH_COOKIE } from "@/lib/auth";
import { getClientIp, isHttpsRequest, rateLimit } from "@/lib/rate-limit";

/** 同一 IP 每分钟最多尝试登录次数，防止暴力破解 */
const LOGIN_LIMIT_PER_MINUTE = 10;

/**
 * 登录接口
 * 校验账号密码，成功后签发 JWT 并写入 HttpOnly Cookie
 */
export async function POST(request: Request) {
  try {
    const limited = rateLimit(
      `login:${getClientIp(request)}`,
      LOGIN_LIMIT_PER_MINUTE,
      60 * 1000
    );
    if (!limited.ok) {
      return NextResponse.json(
        { error: "登录尝试过于频繁，请稍后再试" },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "账号和密码不能为空" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    // 统一错误提示，避免泄露账号是否存在
    if (!user) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    const token = await signToken({ uid: user.id, username: user.username });

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, nickname: user.nickname },
    });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: isHttpsRequest(request),
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("登录失败:", error);
    return NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
}
