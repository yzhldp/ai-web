import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** 单次最多返回的社区评论数 */
const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 5;

/**
 * GET /api/comments/community —— 获取公开项目的最新评论
 * 用于工具 / 创业创新页尚未生成方案时的「社区最新讨论」。
 * 支持 mode=tool|business 按方案类别过滤；仅返回公开方案下的评论。
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const rawMode = searchParams.get("mode");
  if (rawMode && rawMode !== "tool" && rawMode !== "business") {
    return NextResponse.json(
      { error: "mode 仅支持 tool 或 business" },
      { status: 400 }
    );
  }
  const mode = rawMode === "tool" || rawMode === "business" ? rawMode : undefined;

  const comments = await prisma.comment.findMany({
    where: {
      parentId: null,
      plan: {
        visibility: "public",
        ...(mode ? { mode } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, username: true, nickname: true } },
      plan: { select: { id: true, mode: true } },
      _count: { select: { likes: true, favorites: true } },
      likes: { where: { userId: user.id }, select: { id: true } },
      favorites: { where: { userId: user.id }, select: { id: true } },
    },
  });

  return NextResponse.json({
    comments: comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      parentId: comment.parentId,
      user: comment.user,
      plan: comment.plan,
      likeCount: comment._count.likes,
      favoriteCount: comment._count.favorites,
      liked: comment.likes.length > 0,
      favorited: comment.favorites.length > 0,
    })),
  });
}
