/**
 * 多供应商模型网关
 *
 * 支持任意 OpenAI 兼容服务（DeepSeek / 通义千问 / Moonshot / OpenAI / Ollama）。
 * - 通过环境变量启用供应商，`AI_PROVIDER_ORDER` 控制优先级与白名单；
 * - 默认按优先级自动故障转移，可用 `AI_DISABLE_FALLBACK=true` 关闭；
 * - API Key 只在服务端读取，状态接口与健康检查不会返回密钥。
 */

import { createOpenAI } from "@ai-sdk/openai";

export interface ModelProvider {
  id: string;
  label: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

interface ProviderPreset {
  id: string;
  label: string;
  apiKeyEnv: string;
  baseURLEnv?: string;
  modelEnv: string;
  defaultBaseURL: string;
  defaultModel: string;
  /** 仅当该变量存在时才启用（例如本地 Ollama） */
  requiredEnv?: string;
}

/** 供应商目录：新增供应商只需在这里追加一项 */
const PRESETS: ProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseURLEnv: "DEEPSEEK_BASE_URL",
    modelEnv: "DEEPSEEK_MODEL",
    defaultBaseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
  },
  {
    id: "qwen",
    label: "通义千问",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    baseURLEnv: "QWEN_BASE_URL",
    modelEnv: "QWEN_MODEL",
    defaultBaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
  },
  {
    id: "moonshot",
    label: "Moonshot",
    apiKeyEnv: "MOONSHOT_API_KEY",
    baseURLEnv: "MOONSHOT_BASE_URL",
    modelEnv: "MOONSHOT_MODEL",
    defaultBaseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
  },
  {
    id: "openai",
    label: "OpenAI",
    apiKeyEnv: "OPENAI_API_KEY",
    baseURLEnv: "OPENAI_BASE_URL",
    modelEnv: "OPENAI_MODEL",
    defaultBaseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "ollama",
    label: "Ollama 本地",
    apiKeyEnv: "OLLAMA_API_KEY",
    baseURLEnv: "OLLAMA_BASE_URL",
    modelEnv: "OLLAMA_MODEL",
    defaultBaseURL: "http://127.0.0.1:11434/v1",
    defaultModel: "qwen2.5:7b",
    requiredEnv: "OLLAMA_BASE_URL",
  },
];

function resolvePreset(preset: ProviderPreset): ModelProvider | null {
  if (preset.requiredEnv && !process.env[preset.requiredEnv]) return null;

  const apiKey = process.env[preset.apiKeyEnv] || (preset.id === "ollama" ? "ollama" : "");
  if (!apiKey) return null;

  return {
    id: preset.id,
    label: preset.label,
    baseURL: (preset.baseURLEnv && process.env[preset.baseURLEnv]) || preset.defaultBaseURL,
    apiKey,
    model: process.env[preset.modelEnv] || preset.defaultModel,
  };
}

/** 已配置且按优先级排序的供应商候选列表 */
export function listProviders(): ModelProvider[] {
  const all = PRESETS.map(resolvePreset).filter((item): item is ModelProvider => Boolean(item));

  const orderValue = process.env.AI_PROVIDER_ORDER?.trim();
  let ordered = all;

  if (orderValue) {
    // 配置了顺序时同时作为白名单：未列出的供应商不参与调用
    const ids = orderValue
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    ordered = ids
      .map((id) => all.find((provider) => provider.id === id))
      .filter((item): item is ModelProvider => Boolean(item));
  }

  if (process.env.AI_DISABLE_FALLBACK === "true") {
    ordered = ordered.slice(0, 1);
  }

  return ordered;
}

/** 主供应商 */
export function getPrimaryProvider(): ModelProvider | null {
  return listProviders()[0] ?? null;
}

/** 是否开启自动故障转移 */
export function isFallbackEnabled() {
  return process.env.AI_DISABLE_FALLBACK !== "true";
}

/** 创建 AI SDK 模型实例 */
export function createProviderModel(provider: ModelProvider) {
  const client = createOpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
  });
  return client(provider.model);
}

function safeHost(baseURL: string) {
  try {
    return new URL(baseURL).host;
  } catch {
    return baseURL;
  }
}

/** 供应商状态（脱敏，不包含 API Key） */
export function describeProviders() {
  const active = listProviders();
  const activeIds = new Set(active.map((provider) => provider.id));

  return {
    fallbackEnabled: isFallbackEnabled(),
    primaryProvider: active[0]?.id ?? null,
    configuredCount: active.length,
    providers: PRESETS.map((preset) => {
      const resolved = resolvePreset(preset);
      return {
        id: preset.id,
        label: preset.label,
        model: resolved?.model ?? process.env[preset.modelEnv] ?? preset.defaultModel,
        baseHost: safeHost(
          resolved?.baseURL ??
            (preset.baseURLEnv && process.env[preset.baseURLEnv]) ??
            preset.defaultBaseURL
        ),
        configured: Boolean(resolved),
        active: activeIds.has(preset.id),
        primary: active[0]?.id === preset.id,
      };
    }),
  };
}
