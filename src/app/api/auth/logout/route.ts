import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

/**
 * 退出登录接口
 * 清除 HttpOnly Cookie，清除登录态
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
