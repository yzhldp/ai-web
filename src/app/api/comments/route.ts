import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inspectInput } from "@/lib/safety";
import { canAccessPlan } from "@/lib/plan-access";

const commentSchema = z.object({
  planId: z.string().min(1, "缺少 planId").max(64),
  content: z
    .string()
    .trim()
    .min(1, "评论内容不能为空")
    .max(500, "评论不能超过 500 字"),
});

/** 校验方案存在且当前用户可访问（公开方案所有人可读，私有方案仅作者） */
async function assertPlanAccess(planId: string, userId: string) {
  const plan = await prisma.projectPlan.findUnique({
    where: { id: planId },
    select: { userId: true, visibility: true },
  });
  if (!plan) return { ok: false as const, status: 404, error: "方案不存在" };
  if (!canAccessPlan(plan, userId)) {
    return { ok: false as const, status: 403, error: "无权限访问该方案的评论" };
  }
  return { ok: true as const };
}

/**
 * GET /api/comments?planId=xxx —— 获取指定方案的所有评论
 * 公开方案所有登录用户可读；私有方案仅作者可读
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId");
  if (!planId) {
    return NextResponse.json({ error: "缺少 planId 参数" }, { status: 400 });
  }

  const permission = await assertPlanAccess(planId, user.id);
  if (!permission.ok) {
    return NextResponse.json({ error: permission.error }, { status: permission.status });
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
 * 校验归属、长度与基础内容安全，避免无效数据与 UGC 风险
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "评论参数不合法" },
      { status: 400 }
    );
  }

  const { planId, content } = parsed.data;
  const permission = await assertPlanAccess(planId, user.id);
  if (!permission.ok) {
    return NextResponse.json({ error: permission.error }, { status: permission.status });
  }

  const safety = inspectInput([content]);
  if (!safety.allowed) {
    return NextResponse.json(
      { error: safety.reason ?? "评论内容未通过安全审核", safetyFlags: safety.flags },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: {
      planId,
      userId: user.id,
      content,
    },
    include: {
      user: { select: { id: true, username: true, nickname: true } },
    },
  });

  return NextResponse.json({ comment });
}
