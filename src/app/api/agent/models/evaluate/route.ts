import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { describeProviders } from "@/lib/ai/providers";
import { evaluateAllProviders } from "@/lib/ai/evaluation";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** 评测会真实消耗 Token，限制每用户每小时 3 次 */
const EVAL_LIMIT_PER_HOUR = 3;

/** POST /api/agent/models/evaluate —— 对每个已配置供应商运行真实质量评测 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const limited = rateLimit(
    `model-eval:${user.id}`,
    EVAL_LIMIT_PER_HOUR,
    60 * 60 * 1000
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "模型评测过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const status = describeProviders();
  if (status.configuredCount === 0) {
    return NextResponse.json(
      {
        error:
          "未配置任何模型供应商，请设置 DEEPSEEK_API_KEY / DASHSCOPE_API_KEY / MOONSHOT_API_KEY / OPENAI_API_KEY 之一",
      },
      { status: 400 }
    );
  }

  try {
    const startedAt = Date.now();
    const results = await evaluateAllProviders();

    // 每个供应商写入一条审计记录，便于后续对比历史表现
    await Promise.all(
      results.map((item) =>
        writeAudit({
          userId: user.id,
          action: "model.eval",
          success: item.ok,
          latencyMs: item.latencyMs,
          totalTokens: item.tokens,
          provider: item.id,
          model: item.model,
          toolCalls: item.tool.ok ? 1 : 0,
          preview: `structured:${item.structured.ok},tool:${item.tool.ok},citation:${item.citation.ok}`,
        })
      )
    );

    return NextResponse.json({
      evaluatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      fallbackEnabled: status.fallbackEnabled,
      primaryProvider: status.primaryProvider,
      results,
    });
  } catch (error) {
    console.error("[models] 评测失败", error);
    return NextResponse.json(
      { error: "模型评测失败，请检查供应商配置或稍后重试" },
      { status: 500 }
    );
  }
}
