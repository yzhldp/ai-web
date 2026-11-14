import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { inspectInput, maskPII } from "@/lib/safety";
import { generateTextWithFailover } from "@/lib/ai/failover";
import { writeAudit } from "@/lib/audit";
import { OFFLINE_FALLBACK } from "@/lib/assistant-faq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const requestSchema = z.object({
  message: z.string().trim().min(1, "消息不能为空").max(500, "消息不能超过 500 字"),
});

const SYSTEM_PROMPT = `你是「创意雏形合成助手」的站内客服，回答必须简洁、准确，不超过 100 字。

项目事实：
- 两大模式：工具创新（软件开发方案）、创业创新（商业方案）。
- 工作流：需求解析 → 知识检索 → 工具推理 → 方案生成 → 质检与架构图。
- 支持方案迭代、知识库检索与引用、AI 审计、Markdown/PDF 导出。
- 方案与评论仅本人可见；未接 AI 时仍支持本地 FAQ 与页面跳转。
- 站内路由：/tool、/business、/profile、/home。

要求：
1. 只回答与本站使用、功能、AI 能力、数据安全、方案生成相关的问题；
2. 不编造本站没有的功能；
3. 用户明确要求跳转时，在回答末尾追加 [[NAV:tool]] / [[NAV:business]] / [[NAV:profile]] / [[NAV:home]]，否则不要输出该标记。`;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const limited = rateLimit(`assistant:${user.id}`, 20, 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "提问过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "消息不合法" },
      { status: 400 }
    );
  }

  const safety = inspectInput([parsed.data.message]);
  if (!safety.allowed) {
    return NextResponse.json(
      {
        reply: "这个问题涉及不安全内容，我无法回答。你可以问我项目功能、使用步骤或页面跳转。",
        offline: true,
      },
      { status: 200 }
    );
  }

  const startedAt = Date.now();
  try {
    const result = await generateTextWithFailover({
      system: SYSTEM_PROMPT,
      prompt: parsed.data.message,
      temperature: 0.3,
      timeoutMs: 25000,
    });

    await writeAudit({
      userId: user.id,
      action: "assistant",
      success: true,
      safetyFlags: safety.flags,
      inputChars: parsed.data.message.length,
      latencyMs: Date.now() - startedAt,
      totalTokens: result.usage.totalTokens,
      provider: result.provider.id,
      model: result.provider.model,
      fallbacks: result.attempts.filter((item) => !item.ok).length,
      preview: maskPII(parsed.data.message).slice(0, 120),
    });

    return NextResponse.json({ reply: result.value.trim(), offline: false });
  } catch (error) {
    // 未配置模型或调用失败时，返回离线提示而不是报错，保证助手仍可用
    console.warn("[assistant] AI 不可用，降级为离线问答:", error);
    return NextResponse.json({ reply: OFFLINE_FALLBACK, offline: true });
  }
}
