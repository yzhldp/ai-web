import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getKnowledgeStats } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 容器健康检查：数据库可用 + 知识库索引已构建 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const knowledge = getKnowledgeStats();

    return NextResponse.json({
      status: "ok",
      db: "ok",
      knowledge: {
        documents: knowledge.documents,
        chunks: knowledge.chunks,
        dimensions: knowledge.dimensions,
      },
      uptimeSeconds: Math.round(process.uptime()),
      checkLatencyMs: Date.now() - startedAt,
      ai: {
        textModelConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
        visionModelConfigured: Boolean(
          process.env.VISION_MODEL &&
            (process.env.VISION_API_KEY || process.env.DEEPSEEK_API_KEY)
        ),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health] 检查失败", error);
    return NextResponse.json(
      { status: "error", db: "unavailable" },
      { status: 503 }
    );
  }
}
