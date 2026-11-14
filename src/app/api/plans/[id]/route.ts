import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatZodError, planUpdateSchema } from "@/lib/validation";
import { canAccessPlan } from "@/lib/plan-access";

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
  // 私有方案仅作者可读；公开方案允许其他登录用户浏览与评论
  if (!canAccessPlan(plan, user.id)) {
    return NextResponse.json({ error: "无权限查看该方案" }, { status: 403 });
  }

  return NextResponse.json({ plan });
}

/**
 * PATCH /api/plans/[id] —— 更新方案内容或公开状态（仅本人可操作）
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const parsed = planUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { content, analysis, sources, quality, diagram, visibility } = parsed.data;

  // 内容迭代与可见性切换至少提交一项
  if (content === undefined && visibility === undefined) {
    return NextResponse.json({ error: "缺少需要更新的内容" }, { status: 400 });
  }

  const updated = await prisma.projectPlan.update({
    where: { id: params.id },
    data: {
      ...(content !== undefined ? { content } : {}),
      ...(analysis !== undefined ? { analysis } : {}),
      ...(sources !== undefined ? { sources } : {}),
      ...(quality !== undefined ? { quality } : {}),
      ...(diagram !== undefined ? { diagram } : {}),
      ...(visibility !== undefined ? { visibility } : {}),
    },
    select: {
      id: true,
      content: true,
      visibility: true,
      updatedAt: true,
    },
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
