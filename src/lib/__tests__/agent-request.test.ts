import { describe, expect, it } from "vitest";
import { agentRequestSchema } from "@/lib/validation";

describe("agentRequestSchema - 用户选择模型", () => {
  it("未指定时默认自动路由", () => {
    const parsed = agentRequestSchema.safeParse({ mode: "tool" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.preferredProvider).toBe("auto");
    }
  });

  it("允许指定已内置的供应商", () => {
    const parsed = agentRequestSchema.safeParse({
      mode: "business",
      preferredProvider: "qwen",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.preferredProvider).toBe("qwen");
    }
  });

  it("允许选择智谱 GLM", () => {
    const parsed = agentRequestSchema.safeParse({
      mode: "tool",
      preferredProvider: "zhipu",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.preferredProvider).toBe("zhipu");
    }
  });

  it("拒绝未知供应商", () => {
    const parsed = agentRequestSchema.safeParse({
      mode: "tool",
      preferredProvider: "unknown-model",
    });
    expect(parsed.success).toBe(false);
  });

  it("迭代请求同样支持模型选择", () => {
    const parsed = agentRequestSchema.safeParse({
      mode: "tool",
      action: "iterate",
      context: "# 当前方案",
      instruction: "补充排期",
      preferredProvider: "deepseek",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.preferredProvider).toBe("deepseek");
      expect(parsed.data.action).toBe("iterate");
    }
  });
});
