import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getKnowledgeStats, searchKnowledge } from "@/lib/rag";
import { knowledgeQuerySchema, formatZodError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/knowledge —— 知识库元信息（文档、切块、分类、向量维度） */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  return NextResponse.json(getKnowledgeStats());
}

/** POST /api/knowledge —— 混合检索调试接口，展示每条召回的通道得分 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const parsed = knowledgeQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { query, topK, category } = parsed.data;
  const results = searchKnowledge(query, { topK, category });

  return NextResponse.json({
    query,
    strategy: "hybrid: bm25(0.4) + sparse-vector-cosine(0.6)",
    count: results.length,
    results,
  });
}
