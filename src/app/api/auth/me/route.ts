import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * 获取当前登录用户信息
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  return NextResponse.json({ user });
}

/**
 * 更新当前用户昵称
 */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { nickname } = await request.json();
  const trimmed = String(nickname ?? "").trim();

  // 昵称长度限制
  if (trimmed.length > 20) {
    return NextResponse.json(
      { error: "昵称长度不能超过 20 位" },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { nickname: trimmed || null },
    select: { id: true, username: true, nickname: true },
  });

  return NextResponse.json({ user: updated });
}
