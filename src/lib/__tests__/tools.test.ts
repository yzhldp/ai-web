import { describe, expect, it } from "vitest";
import {
  estimateSchedule,
  recommendTechStack,
  riskChecklist,
  summarizeRisks,
} from "@/lib/agent/tools";

describe("planning tools", () => {
  it("estimates a multi-phase schedule", () => {
    const plan = estimateSchedule({ moduleCount: 6, teamSize: 3 });
    expect(plan.totalWeeks).toBeGreaterThan(0);
    expect(plan.phases).toHaveLength(5);
    expect(plan.bufferWeeks).toBeGreaterThanOrEqual(1);
  });

  it("recommends a cross-platform stack for mini programs", () => {
    const rec = recommendTechStack({ scenario: "微信小程序报名工具", teamSize: 3 });
    expect(rec.frontend).toContain("uni-app");
    expect(rec.rationale.length).toBeGreaterThan(0);
  });

  it("adds compliance risks for education domain", () => {
    const risks = riskChecklist({ mode: "tool", domain: "教育" });
    expect(risks.some((item) => item.category === "合规")).toBe(true);
    expect(summarizeRisks(risks)).toContain("→");
  });
});
