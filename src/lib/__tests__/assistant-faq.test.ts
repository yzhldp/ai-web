import { describe, expect, it } from "vitest";
import { matchLocalIntent, OFFLINE_FALLBACK } from "@/lib/assistant-faq";

describe("offline assistant intents", () => {
  it("answers usage questions without AI", () => {
    const result = matchLocalIntent("这个项目怎么使用？");
    expect(result?.reply).toContain("三步开始");
    expect(result?.path).toBeUndefined();
  });

  it("navigates to tool page when asked", () => {
    const result = matchLocalIntent("跳转到工具创新");
    expect(result?.path).toBe("/tool");
    expect(result?.reply).toContain("工具创新");
  });

  it("navigates to profile with an action verb", () => {
    const result = matchLocalIntent("打开我的个人主页");
    expect(result?.path).toBe("/profile");
  });

  it("prefers the specific mode comparison answer over navigation", () => {
    const result = matchLocalIntent("工具创新和创业创新有什么区别？");
    expect(result?.path).toBeUndefined();
    expect(result?.reply).toContain("商业项目");
  });

  it("explains offline capability", () => {
    const result = matchLocalIntent("没接 AI 能做什么？");
    expect(result?.reply).toContain("没接 AI 也能用");
    expect(OFFLINE_FALLBACK).toContain("离线问答模式");
  });

  it("returns null for unrelated questions so AI can handle them", () => {
    expect(matchLocalIntent("今天天气怎么样")).toBeNull();
  });
});
