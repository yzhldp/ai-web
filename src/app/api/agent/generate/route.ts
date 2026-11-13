import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { inspectInput, maskPII } from "@/lib/safety";
import { writeAudit } from "@/lib/audit";
import { runAgent } from "@/lib/agent/planner";
import type { AgentEvent } from "@/lib/agent/types";
import { agentRequestSchema, formatZodError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 深度 Agent 调用较耗资源，限额低于普通对话 */
const LIMIT_PER_MINUTE = 6;
const LIMIT_PER_DAY = 120;

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * POST /api/agent/generate
 * Agent 多阶段生成接口，以 SSE 推送阶段事件与 Token。
 *
 * 事件协议（每条 data 为一个 JSON）：
 * - stage    阶段开始/结束
 * - analysis 需求解析结果
 * - sources  RAG 检索结果
 * - tool     工具调用与结果
 * - token    增量文本
 * - quality  质检报告
 * - diagram  Mermaid 架构图
 * - warning  降级提示
 * - done     最终结果
 * - error    错误
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("未登录", 401);

  const minute = rateLimit(`agent:minute:${user.id}`, LIMIT_PER_MINUTE, 60 * 1000);
  if (!minute.ok) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(minute.retryAfter) } }
    );
  }
  const day = rateLimit(`agent:day:${user.id}`, LIMIT_PER_DAY, 24 * 60 * 60 * 1000);
  if (!day.ok) {
    return NextResponse.json(
      { error: "今日 AI 额度已用完，请明天再试" },
      { status: 429, headers: { "Retry-After": String(day.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("请求体不是合法的 JSON", 400);
  }

  const parsed = agentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(formatZodError(parsed.error), 400);
  }
  const input = parsed.data;

  if (input.action === "iterate" && !input.context.trim()) {
    return jsonError("迭代需要提供当前方案上下文", 400);
  }

  // 输入安全审查（违法违规 / 提示词注入）
  const safety = inspectInput([
    input.painPoint,
    input.demand,
    input.idea,
    input.instruction,
  ]);
  if (!safety.allowed) {
    await writeAudit({
      userId: user.id,
      action: "agent.generate",
      mode: input.mode,
      success: false,
      safetyFlags: safety.flags,
      preview: safety.maskedText,
    });
    return jsonError(safety.reason ?? "输入内容未通过安全审核", 400, {
      safetyFlags: safety.flags,
    });
  }

  const startedAt = Date.now();
  const encoder = new TextEncoder();

  // 客户端断连或主动取消时，统一中止上游模型调用
  const abortController = new AbortController();
  const onRequestAbort = () => abortController.abort();
  request.signal.addEventListener("abort", onRequestAbort, { once: true });

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // SSE 心跳：避免长耗时生成被反向代理判定为空闲连接
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 15000);

      try {
        const result = await runAgent({
          mode: input.mode,
          action: input.action,
          painPoint: input.painPoint,
          demand: input.demand,
          idea: input.idea,
          instruction: input.instruction,
          context: input.context,
          deep: input.deep,
          imageDataUrl: input.image ?? null,
          signal: abortController.signal,
          emit: send,
        });

        await writeAudit({
          userId: user.id,
          action: `agent.${input.action}`,
          mode: input.mode,
          success: true,
          safetyFlags: [...safety.flags, ...result.safetyFlags],
          retrievalCount: result.sources.length,
          toolCalls: result.tools.length,
          inputChars:
            input.painPoint.length +
            input.demand.length +
            input.idea.length +
            input.instruction.length,
          latencyMs: result.latencyMs,
          totalTokens: result.usage.totalTokens,
          provider: result.provider,
          model: result.model,
          fallbacks: result.fallbacks,
          preview: maskPII(
            [
              input.painPoint,
              input.demand,
              input.idea,
              input.instruction,
            ]
              .filter(Boolean)
              .join(" ")
          ).slice(0, 120),
        });
      } catch (error) {
        console.error("[agent] 生成失败", error);
        const message =
          error instanceof Error && /未配置任何|API key/i.test(error.message)
            ? "未配置可用的模型供应商，请设置 DEEPSEEK_API_KEY 或 DASHSCOPE_API_KEY 等环境变量"
            : error instanceof Error && /abort|cancel|取消/i.test(error.message)
              ? "生成已取消"
              : "AI 生成失败，请稍后重试";
        send({ type: "error", message });

        await writeAudit({
          userId: user.id,
          action: `agent.${input.action}`,
          mode: input.mode,
          success: false,
          safetyFlags: safety.flags,
          inputChars:
            input.painPoint.length +
            input.demand.length +
            input.idea.length +
            input.instruction.length,
          latencyMs: Date.now() - startedAt,
          preview: maskPII(
            [
              input.painPoint,
              input.demand,
              input.idea,
              input.instruction,
            ]
              .filter(Boolean)
              .join(" ")
          ).slice(0, 120),
        });
      } finally {
        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        request.signal.removeEventListener("abort", onRequestAbort);
        try {
          controller.close();
        } catch {
          // 客户端已断开时忽略
        }
      }
    },
    cancel() {
      closed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      request.signal.removeEventListener("abort", onRequestAbort);
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
