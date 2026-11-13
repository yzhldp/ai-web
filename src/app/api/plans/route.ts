import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatZodError, planCreateSchema } from "@/lib/validation";

/**
 * GET /api/plans —— 获取当前用户的历史方案列表
 * 支持通过 mode 查询参数过滤（tool / business）
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  const plans = await prisma.projectPlan.findMany({
    where: {
      userId: user.id,
      ...(mode === "tool" || mode === "business" ? { mode } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      mode: true,
      painPoint: true,
      demand: true,
      idea: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ plans });
}

/**
 * POST /api/plans —— 保存生成的方案
 * 自动关联当前登录用户与对应模式
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

  const parsed = planCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }
  const { mode, painPoint, demand, idea, content, analysis, sources, quality, diagram, hasImage } =
    parsed.data;

  const plan = await prisma.projectPlan.create({
    data: {
      userId: user.id,
      mode,
      painPoint,
      demand,
      idea,
      content,
      analysis: analysis ?? null,
      sources: sources ?? null,
      quality: quality ?? null,
      diagram: diagram ?? null,
      hasImage: hasImage ?? false,
    },
    select: {
      id: true,
      mode: true,
      painPoint: true,
      demand: true,
      idea: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ plan });
}
