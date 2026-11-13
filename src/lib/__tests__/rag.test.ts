import { describe, expect, it } from "vitest";
import { getKnowledgeStats, searchKnowledge } from "@/lib/rag";
import { runRagEvaluation } from "@/lib/rag/evaluation";

describe("RAG hybrid retrieval", () => {
  it("builds the bundled knowledge index", () => {
    const stats = getKnowledgeStats();
    expect(stats.documents).toBeGreaterThanOrEqual(8);
    expect(stats.chunks).toBeGreaterThanOrEqual(20);
    expect(stats.dimensions).toBe(2048);
  });

  it("retrieves the expected document for a schedule query", () => {
    const results = searchKnowledge("小团队开发排期怎么估算", { topK: 6 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((item) => item.docId === "schedule-and-team")).toBe(true);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("supports category filtering and returns channel scores", () => {
    const results = searchKnowledge("RAG 检索增强", {
      topK: 4,
      category: "AI 架构",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.category === "AI 架构")).toBe(true);
    expect(typeof results[0].cosine).toBe("number");
    expect(typeof results[0].bm25).toBe("number");
  });

  it("produces a reasonable score on the built-in eval set", () => {
    const summary = runRagEvaluation(6);
    expect(summary.caseCount).toBeGreaterThanOrEqual(10);
    expect(summary.avgRecall).toBeGreaterThanOrEqual(0.5);
    expect(summary.hitRate).toBeGreaterThanOrEqual(0.8);
    expect(summary.mrr).toBeGreaterThanOrEqual(0.5);
  });
});
