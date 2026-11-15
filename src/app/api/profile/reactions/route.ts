import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/profile/reactions?type=like|favorite
 * 当前用户点赞 / 收藏的评论，仅返回仍可访问的方案（公开或本人）。
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  if (type !== "like" && type !== "favorite") {
    return NextResponse.json(
      { error: "type 仅支持 like 或 favorite" },
      { status: 400 }
    );
  }

  const planAccess = {
    OR: [{ visibility: "public" }, { userId: user.id }],
  };

  const commentInclude = {
    user: { select: { id: true, username: true, nickname: true } },
    plan: { select: { id: true, mode: true, visibility: true } },
    parent: { select: { user: { select: { username: true, nickname: true } } } },
    _count: { select: { likes: true, favorites: true } },
    likes: { where: { userId: user.id }, select: { id: true } },
    favorites: { where: { userId: user.id }, select: { id: true } },
  } as const;

  if (type === "like") {
    const rows = await prisma.commentLike.findMany({
      where: {
        userId: user.id,
        comment: { plan: planAccess },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { comment: { include: commentInclude } },
    });

    return NextResponse.json({
      items: rows.map(({ comment, createdAt }) => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        reactedAt: createdAt,
        user: comment.user,
        plan: comment.plan,
        replyTo: comment.parent
          ? comment.parent.user.nickname || comment.parent.user.username
          : null,
        likeCount: comment._count.likes,
        favoriteCount: comment._count.favorites,
        liked: comment.likes.length > 0,
        favorited: comment.favorites.length > 0,
      })),
    });
  }

  const rows = await prisma.commentFavorite.findMany({
    where: {
      userId: user.id,
      comment: { plan: planAccess },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { comment: { include: commentInclude } },
  });

  return NextResponse.json({
    items: rows.map(({ comment, createdAt }) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      reactedAt: createdAt,
      user: comment.user,
      plan: comment.plan,
      replyTo: comment.parent
        ? comment.parent.user.nickname || comment.parent.user.username
        : null,
      likeCount: comment._count.likes,
      favoriteCount: comment._count.favorites,
      liked: comment.likes.length > 0,
      favorited: comment.favorites.length > 0,
    })),
  });
}
