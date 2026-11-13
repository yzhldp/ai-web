/**
 * 模型调用故障转移
 *
 * 统一封装结构化生成、普通生成与流式生成：
 * - 按优先级尝试已配置供应商；
 * - 非流式调用失败、超时、返回非法 JSON 都会自动切换下一家；
 * - 流式调用在「首 Token 之前」失败可无缝切换，一旦开始输出则不再切换，避免内容重复。
 */

import {
  generateText,
  streamText,
  type CoreMessage,
  type LanguageModelUsage,
  type ToolSet,
} from "ai";
import { z } from "zod";
import {
  createProviderModel,
  listProviders,
  type ModelProvider,
} from "./providers";

export interface ProviderAttempt {
  id: string;
  label: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/** 工具调用步骤的结构化视图，避免上层依赖 AI SDK 的复杂泛型 */
export interface ToolStepLike {
  toolCalls?: { toolCallId?: string; toolName: string; args?: unknown }[];
  toolResults?: {
    toolCallId?: string;
    toolName: string;
    args?: unknown;
    result: unknown;
  }[];
}

export interface FailoverResult<T> {
  value: T;
  provider: ModelProvider;
  attempts: ProviderAttempt[];
  usage: LanguageModelUsage;
  /** 工具调用阶段的多步结果，便于上层提取调用轨迹 */
  steps?: ToolStepLike[];
}

interface BaseOptions {
  system?: string;
  prompt?: string;
  messages?: CoreMessage[];
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  onProvider?: (provider: ModelProvider, fallbacks: number) => void;
  onFailure?: (attempt: ProviderAttempt) => void;
}

interface TextOptions extends BaseOptions {
  tools?: ToolSet;
  maxSteps?: number;
  /** 要求至少发生一次工具调用，否则视为该供应商失败并切换 */
  requireToolCalls?: boolean;
}

interface StreamOptions extends BaseOptions {
  onToken: (delta: string) => void;
  /** 首 Token 超时，超时后切换下一供应商 */
  firstTokenTimeoutMs?: number;
}

/** 将外部取消信号与超时合并（供视觉模型等自定义调用复用） */
export function timeoutSignal(ms: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!external) return timeout;

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (external.aborted) controller.abort();
  else external.addEventListener("abort", abort, { once: true });
  timeout.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 180);
}

/** 统一 usage 结构，部分供应商流式响应不带 usage 或返回 NaN */
function normalizeUsage(usage?: Partial<LanguageModelUsage> | null): LanguageModelUsage {
  const count = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  const promptTokens = count(usage?.promptTokens);
  const completionTokens = count(usage?.completionTokens);
  const totalTokens = count(usage?.totalTokens);
  return {
    promptTokens,
    completionTokens,
    totalTokens: totalTokens > 0 ? totalTokens : promptTokens + completionTokens,
  };
}

function ensureProviders(): ModelProvider[] {
  const providers = listProviders();
  if (!providers.length) {
    throw new Error(
      "未配置任何可用的模型供应商，请在环境变量中设置 DEEPSEEK_API_KEY / DASHSCOPE_API_KEY / MOONSHOT_API_KEY / OPENAI_API_KEY 之一"
    );
  }
  return providers;
}

/** 从模型输出中提取 JSON（兼容代码围栏与前后解释文字） */
export function extractJSON(text: string): unknown | null {
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

function buildAttempt(
  provider: ModelProvider,
  started: number,
  error?: string
): ProviderAttempt {
  return {
    id: provider.id,
    label: provider.label,
    model: provider.model,
    ok: !error,
    latencyMs: Date.now() - started,
    error,
  };
}

/** 普通文本生成，失败自动切换供应商 */
export async function generateTextWithFailover(
  options: TextOptions
): Promise<FailoverResult<string>> {
  const providers = ensureProviders();
  const attempts: ProviderAttempt[] = [];
  let lastError = "未知错误";

  for (const provider of providers) {
    if (options.signal?.aborted) throw new Error("请求已取消");
    const failures = attempts.filter((item) => !item.ok).length;
    options.onProvider?.(provider, failures);
    const started = Date.now();

    try {
      const input = options.messages?.length
        ? { messages: options.messages }
        : { prompt: options.prompt ?? "" };
      const result = await generateText({
        model: createProviderModel(provider),
        system: options.system,
        ...input,
        temperature: options.temperature,
        maxRetries: options.maxRetries ?? 1,
        tools: options.tools,
        maxSteps: options.maxSteps,
        abortSignal: timeoutSignal(options.timeoutMs ?? 90000, options.signal),
      });

      if (
        options.requireToolCalls &&
        !result.steps.some((step) => (step.toolCalls?.length ?? 0) > 0)
      ) {
        throw new Error("模型未产生工具调用");
      }

      attempts.push(buildAttempt(provider, started));
      return {
        value: result.text,
        provider,
        attempts,
        usage: normalizeUsage(result.usage),
        steps: result.steps as unknown as ToolStepLike[],
      };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const attempt = buildAttempt(provider, started, errorMessage(error));
      attempts.push(attempt);
      options.onFailure?.(attempt);
      lastError = attempt.error ?? lastError;
    }
  }

  throw new Error(`所有模型供应商均调用失败：${lastError}`);
}

/** 结构化 JSON 生成，Schema 校验失败同样触发切换 */
export async function generateJSONWithFailover<T>(
  options: BaseOptions & { schema: z.ZodType<T>; timeoutMs?: number }
): Promise<FailoverResult<T>> {
  const providers = ensureProviders();
  const attempts: ProviderAttempt[] = [];
  let lastError = "未知错误";

  for (const provider of providers) {
    if (options.signal?.aborted) throw new Error("请求已取消");
    const failures = attempts.filter((item) => !item.ok).length;
    options.onProvider?.(provider, failures);
    const started = Date.now();

    try {
      const input = options.messages?.length
        ? { messages: options.messages }
        : { prompt: options.prompt ?? "" };
      const result = await generateText({
        model: createProviderModel(provider),
        system: options.system,
        ...input,
        temperature: options.temperature,
        maxRetries: options.maxRetries ?? 1,
        abortSignal: timeoutSignal(options.timeoutMs ?? 60000, options.signal),
      });

      const parsed = options.schema.safeParse(extractJSON(result.text));
      if (!parsed.success) {
        throw new Error("模型输出不符合 JSON Schema");
      }

      attempts.push(buildAttempt(provider, started));
      return {
        value: parsed.data,
        provider,
        attempts,
        usage: normalizeUsage(result.usage),
      };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const attempt = buildAttempt(provider, started, errorMessage(error));
      attempts.push(attempt);
      options.onFailure?.(attempt);
      lastError = attempt.error ?? lastError;
    }
  }

  throw new Error(`所有模型供应商均未返回有效结果：${lastError}`);
}

/**
 * 流式生成，首 Token 前失败自动切换。
 * 已产生 Token 后若中断则抛错，不再切换，避免前端出现重复内容。
 */
export async function streamTextWithFailover(
  options: StreamOptions
): Promise<FailoverResult<string>> {
  const providers = ensureProviders();
  const attempts: ProviderAttempt[] = [];
  let lastError = "未知错误";

  for (const provider of providers) {
    if (options.signal?.aborted) throw new Error("请求已取消");
    const failures = attempts.filter((item) => !item.ok).length;
    options.onProvider?.(provider, failures);
    const started = Date.now();
    let received = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener("abort", abort, { once: true });

    // 首 Token 超时用于快速切换；收到首 Token 后改为整体超时
    const firstTokenTimeout =
      options.firstTokenTimeoutMs ??
      Number(process.env.AI_FIRST_TOKEN_TIMEOUT_MS || 20000);
    timer = setTimeout(() => controller.abort(), firstTokenTimeout);

    try {
      const input = options.messages?.length
        ? { messages: options.messages }
        : { prompt: options.prompt ?? "" };
      const result = streamText({
        model: createProviderModel(provider),
        system: options.system,
        ...input,
        temperature: options.temperature,
        maxRetries: options.maxRetries ?? 0,
        abortSignal: controller.signal,
      });

      let content = "";
      for await (const delta of result.textStream) {
        if (!received) {
          received = true;
          if (timer) clearTimeout(timer);
          timer = setTimeout(
            () => controller.abort(),
            options.timeoutMs ?? 150000
          );
        }
        content += delta;
        options.onToken(delta);
      }

      if (!content.trim()) {
        throw new Error("供应商返回空内容");
      }

      const usage = await result.usage;
      attempts.push(buildAttempt(provider, started));
      return {
        value: content,
        provider,
        attempts,
        usage: normalizeUsage(usage),
      };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const attempt = buildAttempt(provider, started, errorMessage(error));
      attempts.push(attempt);
      options.onFailure?.(attempt);
      lastError = attempt.error ?? lastError;

      // 已产生部分输出时无法安全切换，直接向上抛出
      if (received) {
        throw new Error(`流式生成中断（${provider.label}）：${lastError}`);
      }
    } finally {
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  throw new Error(`所有模型供应商均调用失败：${lastError}`);
}
