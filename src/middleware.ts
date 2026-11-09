import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

/** 需要登录鉴权的页面路由前缀 */
const PROTECTED_PATHS = ["/home", "/tool", "/business", "/profile", "/plans"];

/** 仅未登录用户可访问（登录后访问则跳转首页） */
const AUTH_PATHS = ["/login"];

/**
 * 鉴权中间件
 * 校验 HttpOnly Cookie 中的 JWT，实现页面级路由保护
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth_token")?.value;

  // 校验 JWT 是否有效
  let isAuthenticated = false;
  if (token) {
    try {
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || "dev-secret-change-me"
      );
      await jwtVerify(token, secret);
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isAuthPage = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  // 未登录访问受保护页面 -> 跳转登录页
  if (isProtected && !isAuthenticated) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  // 已登录访问登录页 -> 跳转首页
  if (isAuthPage && isAuthenticated) {
    const url = new URL("/home", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home/:path*",
    "/tool/:path*",
    "/business/:path*",
    "/profile/:path*",
    "/plans/:path*",
    "/login/:path*",
  ],
};
