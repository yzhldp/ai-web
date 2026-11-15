import { afterEach, describe, expect, it } from "vitest";
import {
  describeProviders,
  isFallbackEnabled,
  listProviders,
} from "@/lib/ai/providers";

const KEYS = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_BASE_URL",
  "DASHSCOPE_API_KEY",
  "QWEN_MODEL",
  "MOONSHOT_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_BASE_URL",
  "ZHIPU_API_KEY",
  "ZHIPU_MODEL",
  "ZHIPU_BASE_URL",
  "OLLAMA_BASE_URL",
  "AI_PROVIDER_ORDER",
  "AI_DISABLE_FALLBACK",
];

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("multi-provider configuration", () => {
  it("orders providers according to AI_PROVIDER_ORDER", () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-secret";
    process.env.DASHSCOPE_API_KEY = "qwen-secret";
    process.env.AI_PROVIDER_ORDER = "qwen,deepseek";

    expect(listProviders().map((provider) => provider.id)).toEqual([
      "qwen",
      "deepseek",
    ]);
  });

  it("can disable fallback and keep only the primary", () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-secret";
    process.env.DASHSCOPE_API_KEY = "qwen-secret";
    process.env.AI_DISABLE_FALLBACK = "true";

    expect(isFallbackEnabled()).toBe(false);
    expect(listProviders()).toHaveLength(1);
    expect(listProviders()[0].id).toBe("deepseek");
  });

  it("never exposes api keys in provider status", () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-super-secret-123";
    process.env.DASHSCOPE_API_KEY = "qwen-super-secret-456";

    const status = describeProviders();
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("deepseek-super-secret-123");
    expect(serialized).not.toContain("qwen-super-secret-456");
    expect(status.configuredCount).toBe(2);
    expect(status.primaryProvider).toBe("deepseek");
  });

  it("returns an empty list when nothing is configured", () => {
    expect(listProviders()).toEqual([]);
  });

  it("moves the user-selected provider to the front", () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-secret";
    process.env.DASHSCOPE_API_KEY = "qwen-secret";
    process.env.MOONSHOT_API_KEY = "moonshot-secret";
    process.env.AI_PROVIDER_ORDER = "deepseek,qwen,moonshot";

    expect(listProviders("moonshot").map((provider) => provider.id)).toEqual([
      "moonshot",
      "deepseek",
      "qwen",
    ]);
  });

  it("uses only the selected provider when fallback is disabled", () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-secret";
    process.env.DASHSCOPE_API_KEY = "qwen-secret";
    process.env.AI_DISABLE_FALLBACK = "true";

    expect(listProviders("qwen").map((provider) => provider.id)).toEqual([
      "qwen",
    ]);
  });

  it("keeps the default order when the selected provider is unavailable", () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-secret";
    expect(listProviders("openai").map((provider) => provider.id)).toEqual([
      "deepseek",
    ]);
  });

  it("supports dedicated Zhipu GLM configuration", () => {
    process.env.ZHIPU_API_KEY = "zhipu-secret";
    process.env.ZHIPU_MODEL = "glm-4-flash";

    const provider = listProviders()[0];
    expect(provider.id).toBe("zhipu");
    expect(provider.label).toBe("智谱 GLM");
    expect(provider.model).toBe("glm-4-flash");
  });

  it("labels GLM in the OpenAI-compatible slot as 智谱 GLM", () => {
    process.env.OPENAI_API_KEY = "zhipu-secret";
    process.env.OPENAI_MODEL = "glm-4-flash";
    process.env.OPENAI_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

    const provider = listProviders()[0];
    expect(provider.id).toBe("openai");
    expect(provider.label).toBe("智谱 GLM");
  });

  it("marks Zhipu as enabled in provider status", () => {
    process.env.ZHIPU_API_KEY = "zhipu-secret";
    const status = describeProviders();
    const zhipu = status.providers.find((provider) => provider.id === "zhipu");
    expect(zhipu?.enabled).toBe(true);
    expect(status.primaryProvider).toBe("zhipu");
  });
});
