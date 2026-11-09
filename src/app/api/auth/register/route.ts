import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken, AUTH_COOKIE } from "@/lib/auth";

/**
 * 注册接口
 * 校验账号（1-20位）与密码（6-20位），校验账号全局唯一
 * 成功后使用 bcryptjs 加密密码，签发 JWT 并写入 HttpOnly Cookie
 */
export async function POST(request: Request) {
  try {
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

    // 密码 6-20 位字符
    if (password.length < 6 || password.length > 20) {
      return NextResponse.json(
        { error: "密码长度需在 6-20 位之间" },
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
    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
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
