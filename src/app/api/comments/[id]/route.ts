import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canDeleteComment } from "@/lib/plan-access";

/**
 * DELETE /api/comments/[id] —— 删除评论
 * 权限：评论作者本人，或该方案作者（便于项目维护者治理评论区）。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      plan: { select: { userId: true } },
    },
  });

  if (!comment) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }

  if (
    !canDeleteComment(
      { commentUserId: comment.userId, planOwnerId: comment.plan.userId },
      user.id
    )
  ) {
    return NextResponse.json(
      { error: "无权限删除该评论" },
      { status: 403 }
    );
  }

  await prisma.comment.delete({ where: { id: comment.id } });

  return NextResponse.json({ success: true });
}
