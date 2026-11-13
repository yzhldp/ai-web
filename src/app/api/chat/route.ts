import { streamText, convertToCoreMessages } from "ai";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getDeepSeekModel,
  buildToolSystemPrompt,
  buildBusinessSystemPrompt,
  buildIterateSystemPrompt,
  buildAssistantSystemPrompt,
} from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";

/** 允许流式输出最大时长（DeepSeek 推理可能较慢） */
export const maxDuration = 60;

/** 单次请求的输入上限，防止超长上下文放大成本 */
const MAX_MESSAGES = 30;
const MAX_MESSAGES_BYTES = 20000;
const MAX_CONTEXT_CHARS = 20000;

/** 单用户调用频次限制 */
const LIMIT_PER_MINUTE = 10;
const LIMIT_PER_DAY = 200;

function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: "请求过于频繁，请稍后再试" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/**
 * AI 统一代理接口
 * 通过服务端读取 DEEPSEEK_API_KEY，使用 Vercel AI SDK streamText 实现流式输出。
 *
 * 支持三种动作（action）：
 * - assistant：悬浮助手通用问答 + 路由指令识别
 * - generate ：根据痛点/需求/奇思妙想合成方案
 * - iterate  ：基于当前方案上下文迭代优化
 */
export async function POST(request: Request) {
  // 鉴权校验
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 频次限制：防止单个账号刷爆 AI 额度
  const perMinute = rateLimit(
    `chat:minute:${user.id}`,
    LIMIT_PER_MINUTE,
    60 * 1000
  );
  if (!perMinute.ok) {
    return tooManyRequests(perMinute.retryAfter);
  }
  const perDay = rateLimit(
    `chat:day:${user.id}`,
    LIMIT_PER_DAY,
    24 * 60 * 60 * 1000
  );
  if (!perDay.ok) {
    return tooManyRequests(perDay.retryAfter);
  }

  const {
    messages = [],
    action = "assistant",
    mode = "tool",
    context = "",
  } = await request.json();

  // 输入规模限制
  if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
    return NextResponse.json(
      { error: `消息条数不能超过 ${MAX_MESSAGES} 条` },
      { status: 400 }
    );
  }
  if (JSON.stringify(messages).length > MAX_MESSAGES_BYTES) {
    return NextResponse.json(
      { error: "输入内容过长，请精简后重试" },
      { status: 413 }
    );
  }
  if (typeof context === "string" && context.length > MAX_CONTEXT_CHARS) {
    return NextResponse.json(
      { error: "方案上下文过长，请精简后重试" },
      { status: 413 }
    );
  }

  // 根据动作与模式构建系统提示词
  let system: string;
  if (action === "generate") {
    system =
      mode === "tool" ? buildToolSystemPrompt() : buildBusinessSystemPrompt();
  } else if (action === "iterate") {
    system = buildIterateSystemPrompt(mode === "tool" ? "tool" : "business");
    if (context) {
      system += `\n\n以下是当前方案内容（作为迭代基础）：\n${context}`;
    }
  } else {
    system = buildAssistantSystemPrompt();
  }

  // 流式生成
  const result = streamText({
    model: getDeepSeekModel(),
    system,
    messages: convertToCoreMessages(messages),
  });

  // 悬浮助手使用 useChat 客户端，需返回 data stream 协议；
  // 方案生成/迭代使用手动流式读取，返回纯文本流
  if (action === "assistant") {
    return result.toDataStreamResponse();
  }
  return result.toTextStreamResponse();
}
