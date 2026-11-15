import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inspectInput } from "@/lib/safety";
import { canAccessPlan, canDeleteComment } from "@/lib/plan-access";

const commentSchema = z.object({
  planId: z.string().min(1, "缺少 planId").max(64),
  content: z
    .string()
    .trim()
    .min(1, "评论内容不能为空")
    .max(500, "评论不能超过 500 字"),
  /** 回复的根评论 ID；为空表示发表一级评论 */
  parentId: z.string().min(1).max(64).optional(),
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
  return { ok: true as const, planOwnerId: plan.userId };
}

/**
 * GET /api/comments?planId=xxx —— 获取指定方案的全部评论
 * 返回扁平列表（含 parentId），前端按 parentId 组装一级评论与回复。
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
      parent: {
        select: {
          id: true,
          user: { select: { username: true, nickname: true } },
        },
      },
      _count: { select: { likes: true, favorites: true } },
      likes: { where: { userId: user.id }, select: { id: true } },
      favorites: { where: { userId: user.id }, select: { id: true } },
    },
  });

  const normalized = comments.map((comment) => ({
    id: comment.id,
    planId: comment.planId,
    parentId: comment.parentId,
    content: comment.content,
    createdAt: comment.createdAt,
    user: comment.user,
    canDelete: canDeleteComment(
      { commentUserId: comment.userId, planOwnerId: permission.planOwnerId },
      user.id
    ),
    likeCount: comment._count.likes,
    favoriteCount: comment._count.favorites,
    liked: comment.likes.length > 0,
    favorited: comment.favorites.length > 0,
    replyTo: comment.replyToName
      ? { id: comment.parentId ?? comment.id, nickname: comment.replyToName }
      : comment.parent
        ? {
            id: comment.parent.id,
            nickname:
              comment.parent.user.nickname || comment.parent.user.username,
          }
        : null,
  }));

  return NextResponse.json({ comments: normalized });
}

/**
 * POST /api/comments —— 发布评论或回复
 * 校验归属、长度与基础内容安全，避免无效数据与 UGC 风险。
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

  const { planId, content, parentId } = parsed.data;
  const permission = await assertPlanAccess(planId, user.id);
  if (!permission.ok) {
    return NextResponse.json({ error: permission.error }, { status: permission.status });
  }

  // 只保留一级回复：回复回复时统一挂到根评论下
  let rootParentId: string | null = null;
  let replyTo: { id: string; nickname: string } | null = null;
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        planId: true,
        parentId: true,
        user: { select: { username: true, nickname: true } },
      },
    });
    if (!parent || parent.planId !== planId) {
      return NextResponse.json({ error: "回复的评论不存在" }, { status: 400 });
    }
    rootParentId = parent.parentId ?? parent.id;
    replyTo = {
      id: parent.id,
      nickname: parent.user.nickname || parent.user.username,
    };
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
      parentId: rootParentId,
      replyToName: replyTo?.nickname ?? null,
      content,
    },
    include: {
      user: { select: { id: true, username: true, nickname: true } },
    },
  });

  return NextResponse.json({
    comment: {
      ...comment,
      canDelete: true,
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
      replyTo,
    },
  });
}
