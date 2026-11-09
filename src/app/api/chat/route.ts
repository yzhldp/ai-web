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

/** 允许流式输出最大时长（DeepSeek 推理可能较慢） */
export const maxDuration = 60;

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

  const {
    messages = [],
    action = "assistant",
    mode = "tool",
    context = "",
  } = await request.json();

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
