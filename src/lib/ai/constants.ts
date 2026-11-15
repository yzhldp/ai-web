/** 已内置的模型供应商 ID（与 providers.ts 中的 PRESETS 保持一致） */
export const PROVIDER_IDS = [
  "deepseek",
  "qwen",
  "moonshot",
  "openai",
  "ollama",
] as const;

/** Agent 请求可选模型：auto 表示按服务器优先级自动选择 */
export const AGENT_PROVIDER_IDS = ["auto", ...PROVIDER_IDS] as const;

export type AgentProviderId = (typeof AGENT_PROVIDER_IDS)[number];
