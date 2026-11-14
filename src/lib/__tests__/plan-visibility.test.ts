import { describe, expect, it } from "vitest";
import { canAccessPlan, isPlanOwner } from "@/lib/plan-access";
import { planCreateSchema, planUpdateSchema } from "@/lib/validation";

const OWNER_ID = "user-owner";
const OTHER_ID = "user-other";

describe("canAccessPlan - 方案公开/私有访问控制", () => {
  it("作者可以访问自己的私有方案", () => {
    expect(
      canAccessPlan({ userId: OWNER_ID, visibility: "private" }, OWNER_ID)
    ).toBe(true);
  });

  it("作者可以访问自己的公开方案", () => {
    expect(
      canAccessPlan({ userId: OWNER_ID, visibility: "public" }, OWNER_ID)
    ).toBe(true);
  });

  it("其他用户可以访问公开方案", () => {
    expect(
      canAccessPlan({ userId: OWNER_ID, visibility: "public" }, OTHER_ID)
    ).toBe(true);
  });

  it("其他用户不能访问私有方案", () => {
    expect(
      canAccessPlan({ userId: OWNER_ID, visibility: "private" }, OTHER_ID)
    ).toBe(false);
  });

  it("未知可见性按私有处理，避免脏数据导致越权", () => {
    expect(
      canAccessPlan({ userId: OWNER_ID, visibility: "team" }, OTHER_ID)
    ).toBe(false);
  });

  it("isPlanOwner 仅对作者返回 true", () => {
    const plan = { userId: OWNER_ID, visibility: "public" };
    expect(isPlanOwner(plan, OWNER_ID)).toBe(true);
    expect(isPlanOwner(plan, OTHER_ID)).toBe(false);
  });
});

describe("planCreateSchema - 新建方案默认私有", () => {
  const base = {
    mode: "tool" as const,
    content: "# 示例方案内容",
  };

  it("未传 visibility 时默认私有", () => {
    const parsed = planCreateSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.visibility).toBe("private");
    }
  });

  it("允许创建时直接设为公开", () => {
    const parsed = planCreateSchema.safeParse({ ...base, visibility: "public" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.visibility).toBe("public");
    }
  });

  it("拒绝非法可见性取值", () => {
    const parsed = planCreateSchema.safeParse({ ...base, visibility: "team" });
    expect(parsed.success).toBe(false);
  });

  it("方案内容不能为空", () => {
    const parsed = planCreateSchema.safeParse({
      mode: "tool",
      content: "",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("planUpdateSchema - 可见性切换与内容迭代", () => {
  it("允许仅提交 visibility 进行公开/私有切换", () => {
    const parsed = planUpdateSchema.safeParse({ visibility: "public" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.visibility).toBe("public");
      expect(parsed.data.content).toBeUndefined();
    }
  });

  it("允许仅提交 content 进行方案迭代", () => {
    const parsed = planUpdateSchema.safeParse({ content: "# 新内容" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.content).toBe("# 新内容");
      expect(parsed.data.visibility).toBeUndefined();
    }
  });

  it("同时提交内容与可见性时均生效", () => {
    const parsed = planUpdateSchema.safeParse({
      content: "# 新内容",
      visibility: "private",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.content).toBe("# 新内容");
      expect(parsed.data.visibility).toBe("private");
    }
  });

  it("拒绝非法可见性取值", () => {
    const parsed = planUpdateSchema.safeParse({ visibility: "friends" });
    expect(parsed.success).toBe(false);
  });

  it("拒绝空字符串内容", () => {
    const parsed = planUpdateSchema.safeParse({ content: "" });
    expect(parsed.success).toBe(false);
  });
});
