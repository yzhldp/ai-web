import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/comments?planId=xxx —— 获取指定方案的所有评论
 */
export async function GET(request: Request) {
  // 评论可能包含用户内容，要求登录后可见
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId");

  if (!planId) {
    return NextResponse.json({ error: "缺少 planId 参数" }, { status: 400 });
  }

  const comments = await prisma.comment.findMany({
    where: { planId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, username: true, nickname: true } },
    },
  });

  return NextResponse.json({ comments });
}

/**
 * POST /api/comments —— 发布评论
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { planId, content } = await request.json();

  if (!planId || !content?.trim()) {
    return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      planId,
      userId: user.id,
      content: content.trim(),
    },
    include: {
      user: { select: { id: true, username: true, nickname: true } },
    },
  });

  return NextResponse.json({ comment });
}
