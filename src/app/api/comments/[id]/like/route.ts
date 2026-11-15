import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessPlan } from "@/lib/plan-access";

/** 校验评论存在且当前用户可访问所属方案 */
async function assertCommentAccess(commentId: string, userId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      plan: { select: { userId: true, visibility: true } },
    },
  });
  if (!comment) {
    return { ok: false as const, status: 404, error: "评论不存在" };
  }
  if (!canAccessPlan(comment.plan, userId)) {
    return { ok: false as const, status: 403, error: "无权限操作该评论" };
  }
  return { ok: true as const };
}

async function countLikes(commentId: string) {
  return prisma.commentLike.count({ where: { commentId } });
}

/** POST /api/comments/[id]/like —— 点赞评论 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const access = await assertCommentAccess(params.id, user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  await prisma.commentLike.upsert({
    where: {
      commentId_userId: { commentId: params.id, userId: user.id },
    },
    create: { commentId: params.id, userId: user.id },
    update: {},
  });

  return NextResponse.json({
    liked: true,
    likeCount: await countLikes(params.id),
  });
}

/** DELETE /api/comments/[id]/like —— 取消点赞 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const access = await assertCommentAccess(params.id, user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  await prisma.commentLike.deleteMany({
    where: { commentId: params.id, userId: user.id },
  });

  return NextResponse.json({
    liked: false,
    likeCount: await countLikes(params.id),
  });
}
