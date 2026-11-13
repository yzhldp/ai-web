import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runRagEvaluation } from "@/lib/rag/evaluation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/knowledge/evaluate —— 运行内置 RAG 标注集评测
 * 返回 Recall@K、HitRate、MRR 与逐条检索结果，便于观察检索质量。
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const summary = runRagEvaluation(6);
  return NextResponse.json({
    ...summary,
    generatedAt: new Date().toISOString(),
    note: "内置 10 条标注查询，指标用于开发期对比检索策略，不代表线上真实分布。",
  });
}
