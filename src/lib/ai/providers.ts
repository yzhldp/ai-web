/**
 * 多供应商模型网关
 *
 * 支持任意 OpenAI 兼容服务（DeepSeek / 通义千问 / 智谱 GLM / Kimi / 豆包 / 文心一言 / 腾讯混元 / 讯飞星火 / MiniMax / 阶跃星辰 / 零一万物 / 百川 / 商汤 / 硅基流动 / 自定义 / Ollama）。
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

/** 供应商目录：国内主流模型平台（均支持 OpenAI 兼容协议） */
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
    id: "zhipu",
    label: "智谱 GLM",
    apiKeyEnv: "ZHIPU_API_KEY",
    baseURLEnv: "ZHIPU_BASE_URL",
    modelEnv: "ZHIPU_MODEL",
    defaultBaseURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
  },
  {
    id: "moonshot",
    label: "Kimi（Moonshot）",
    apiKeyEnv: "MOONSHOT_API_KEY",
    baseURLEnv: "MOONSHOT_BASE_URL",
    modelEnv: "MOONSHOT_MODEL",
    defaultBaseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
  },
  {
    id: "doubao",
    label: "豆包（火山方舟）",
    apiKeyEnv: "DOUBAO_API_KEY",
    baseURLEnv: "DOUBAO_BASE_URL",
    modelEnv: "DOUBAO_MODEL",
    defaultBaseURL: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-1-5-pro-32k-250115",
  },
  {
    id: "qianfan",
    label: "文心一言（千帆）",
    apiKeyEnv: "QIANFAN_API_KEY",
    baseURLEnv: "QIANFAN_BASE_URL",
    modelEnv: "QIANFAN_MODEL",
    defaultBaseURL: "https://qianfan.baidubce.com/v2",
    defaultModel: "ernie-4.5-turbo-128k",
  },
  {
    id: "hunyuan",
    label: "腾讯混元",
    apiKeyEnv: "HUNYUAN_API_KEY",
    baseURLEnv: "HUNYUAN_BASE_URL",
    modelEnv: "HUNYUAN_MODEL",
    defaultBaseURL: "https://api.hunyuan.cloud.tencent.com/v1",
    defaultModel: "hunyuan-turbos-latest",
  },
  {
    id: "spark",
    label: "讯飞星火",
    apiKeyEnv: "SPARK_API_KEY",
    baseURLEnv: "SPARK_BASE_URL",
    modelEnv: "SPARK_MODEL",
    defaultBaseURL: "https://spark-api-open.xf-yun.com/v1",
    defaultModel: "generalv3.5",
  },
  {
    id: "minimax",
    label: "MiniMax",
    apiKeyEnv: "MINIMAX_API_KEY",
    baseURLEnv: "MINIMAX_BASE_URL",
    modelEnv: "MINIMAX_MODEL",
    defaultBaseURL: "https://api.minimax.chat/v1",
    defaultModel: "MiniMax-Text-01",
  },
  {
    id: "stepfun",
    label: "阶跃星辰",
    apiKeyEnv: "STEPFUN_API_KEY",
    baseURLEnv: "STEPFUN_BASE_URL",
    modelEnv: "STEPFUN_MODEL",
    defaultBaseURL: "https://api.stepfun.com/v1",
    defaultModel: "step-2-16k",
  },
  {
    id: "yi",
    label: "零一万物",
    apiKeyEnv: "YI_API_KEY",
    baseURLEnv: "YI_BASE_URL",
    modelEnv: "YI_MODEL",
    defaultBaseURL: "https://api.lingyiwanwu.com/v1",
    defaultModel: "yi-lightning",
  },
  {
    id: "baichuan",
    label: "百川智能",
    apiKeyEnv: "BAICHUAN_API_KEY",
    baseURLEnv: "BAICHUAN_BASE_URL",
    modelEnv: "BAICHUAN_MODEL",
    defaultBaseURL: "https://api.baichuan-ai.com/v1",
    defaultModel: "Baichuan4",
  },
  {
    id: "sensenova",
    label: "商汤日日新",
    apiKeyEnv: "SENSENOVA_API_KEY",
    baseURLEnv: "SENSENOVA_BASE_URL",
    modelEnv: "SENSENOVA_MODEL",
    defaultBaseURL: "https://api.sensenova.cn/compatible-mode/v1",
    defaultModel: "SenseChat-5",
  },
  {
    id: "siliconflow",
    label: "硅基流动",
    apiKeyEnv: "SILICONFLOW_API_KEY",
    baseURLEnv: "SILICONFLOW_BASE_URL",
    modelEnv: "SILICONFLOW_MODEL",
    defaultBaseURL: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
  },
  {
    id: "custom",
    label: "自定义兼容",
    apiKeyEnv: "CUSTOM_API_KEY",
    baseURLEnv: "CUSTOM_BASE_URL",
    modelEnv: "CUSTOM_MODEL",
    defaultBaseURL: "",
    defaultModel: "custom-model",
    requiredEnv: "CUSTOM_BASE_URL",
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

  const model = process.env[preset.modelEnv] || preset.defaultModel;

  return {
    id: preset.id,
    label: preset.label,
    baseURL: (preset.baseURLEnv && process.env[preset.baseURLEnv]) || preset.defaultBaseURL,
    apiKey,
    model,
  };
}

/** 已配置且通过白名单过滤的供应商（不按「关闭故障转移」截断） */
export function listEnabledProviders(): ModelProvider[] {
  const all = PRESETS.map(resolvePreset).filter((item): item is ModelProvider => Boolean(item));

  const orderValue = process.env.AI_PROVIDER_ORDER?.trim();
  if (!orderValue) return all;

  // 配置了顺序时同时作为白名单：未列出的供应商不参与调用
  const ids = orderValue
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return ids
    .map((id) => all.find((provider) => provider.id === id))
    .filter((item): item is ModelProvider => Boolean(item));
}

/**
 * 已配置且按优先级排序的供应商候选列表
 * @param preferred 用户指定的优先供应商；配置有效时排到第一位
 */
export function listProviders(preferred?: string): ModelProvider[] {
  let ordered = listEnabledProviders();

  if (preferred && preferred !== "auto") {
    const chosen = ordered.find((provider) => provider.id === preferred);
    if (chosen) {
      ordered = [chosen, ...ordered.filter((provider) => provider.id !== chosen.id)];
    }
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
  const enabled = listEnabledProviders();
  const active = listProviders();
  const enabledIds = new Set(enabled.map((provider) => provider.id));
  const activeIds = new Set(active.map((provider) => provider.id));

  return {
    fallbackEnabled: isFallbackEnabled(),
    primaryProvider: active[0]?.id ?? null,
    configuredCount: enabled.length,
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
        /** 是否已配置且通过供应商白名单，可供用户选择 */
        enabled: enabledIds.has(preset.id),
        active: activeIds.has(preset.id),
        primary: active[0]?.id === preset.id,
      };
    }),
  };
}
