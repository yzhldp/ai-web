/**
 * 真实模型质量评测
 *
 * 对每个已配置供应商执行三项最小可用性测试：
 * 1) 结构化 JSON 输出能力；
 * 2) Function Calling 工具调用能力；
 * 3) 带引用标记的生成能力。
 *
 * 评测结果用于选择主供应商与观察降级情况，不构成模型能力的权威结论。
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import { createProviderModel, listProviders, type ModelProvider } from "./providers";
import { timeoutSignal } from "./failover";

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  tokens: number;
  error?: string;
}

export interface ProviderEvaluation {
  id: string;
  label: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  tokens: number;
  structured: TestResult;
  tool: TestResult;
  citation: TestResult;
}

const echoTool = tool({
  description: "回显一个数字，用于验证 Function Calling 是否可用",
  parameters: z.object({ value: z.number().describe("需要回显的数字") }),
  execute: async ({ value }) => ({ value }),
});

function parseJSON(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function errorText(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

async function runTest(
  fn: () => Promise<{ ok: boolean; tokens?: number }>
): Promise<TestResult> {
  const started = Date.now();
  try {
    const result = await fn();
    return {
      ok: result.ok,
      latencyMs: Date.now() - started,
      tokens: result.tokens ?? 0,
      error: result.ok ? undefined : "结果未达到预期",
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      tokens: 0,
      error: errorText(error),
    };
  }
}

/** 评测单个供应商 */
export async function evaluateProvider(provider: ModelProvider): Promise<ProviderEvaluation> {
  const model = createProviderModel(provider);

  const structured = await runTest(async () => {
    const result = await generateText({
      model,
      temperature: 0,
      maxRetries: 0,
      abortSignal: timeoutSignal(25000),
      prompt: '请只输出一个 JSON 对象，不要输出其他文字：{"ok":true,"topics":["AI","RAG"]}',
    });
    const parsed = parseJSON(result.text) as
      | { ok?: boolean; topics?: unknown }
      | null;
    return {
      ok: parsed?.ok === true && Array.isArray(parsed.topics),
      tokens: result.usage.totalTokens,
    };
  });

  const toolTest = await runTest(async () => {
    const result = await generateText({
      model,
      temperature: 0,
      maxRetries: 0,
      maxSteps: 2,
      tools: { echo_value: echoTool },
      abortSignal: timeoutSignal(25000),
      prompt: "请调用 echo_value 工具，参数 value 为 42，然后回复“完成”。",
    });
    return {
      ok: result.steps.some((step) => (step.toolCalls?.length ?? 0) > 0),
      tokens: result.usage.totalTokens,
    };
  });

  const citation = await runTest(async () => {
    const result = await generateText({
      model,
      temperature: 0.3,
      maxRetries: 0,
      abortSignal: timeoutSignal(25000),
      prompt: "用一句话解释 RAG 的作用，并在句末加上引用标记 [1]。",
    });
    return {
      ok: /\[\d+\]/.test(result.text) && result.text.trim().length >= 8,
      tokens: result.usage.totalTokens,
    };
  });

  return {
    id: provider.id,
    label: provider.label,
    model: provider.model,
    ok: structured.ok && toolTest.ok && citation.ok,
    latencyMs: structured.latencyMs + toolTest.latencyMs + citation.latencyMs,
    tokens: structured.tokens + toolTest.tokens + citation.tokens,
    structured,
    tool: toolTest,
    citation,
  };
}

/** 并行评测所有已配置供应商 */
export async function evaluateAllProviders(): Promise<ProviderEvaluation[]> {
  const providers = listProviders();
  return Promise.all(providers.map((provider) => evaluateProvider(provider)));
}
