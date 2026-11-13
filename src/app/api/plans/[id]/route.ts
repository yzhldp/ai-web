import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/plans/[id] —— 获取方案详情（含评论列表）
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  // 方案可能包含用户输入的业务信息，未登录不可读取
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const plan = await prisma.projectPlan.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, username: true, nickname: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, username: true, nickname: true } },
        },
      },
    },
  });

  if (!plan) {
    return NextResponse.json({ error: "方案不存在" }, { status: 404 });
  }

  return NextResponse.json({ plan });
}

/**
 * PATCH /api/plans/[id] —— 迭代更新方案内容（仅本人可操作）
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const plan = await prisma.projectPlan.findUnique({
    where: { id: params.id },
  });
  if (!plan) {
    return NextResponse.json({ error: "方案不存在" }, { status: 404 });
  }
  // 仅方案作者可修改
  if (plan.userId !== user.id) {
    return NextResponse.json({ error: "无权限操作" }, { status: 403 });
  }

  const { content } = await request.json();
  if (!content) {
    return NextResponse.json({ error: "方案内容不能为空" }, { status: 400 });
  }

  const updated = await prisma.projectPlan.update({
    where: { id: params.id },
    data: { content },
    select: { id: true, content: true, updatedAt: true },
  });

  return NextResponse.json({ plan: updated });
}

/**
 * DELETE /api/plans/[id] —— 删除方案（仅本人可操作）
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const plan = await prisma.projectPlan.findUnique({
    where: { id: params.id },
  });
  if (!plan) {
    return NextResponse.json({ error: "方案不存在" }, { status: 404 });
  }
  if (plan.userId !== user.id) {
    return NextResponse.json({ error: "无权限操作" }, { status: 403 });
  }

  await prisma.projectPlan.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
