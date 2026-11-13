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
});
