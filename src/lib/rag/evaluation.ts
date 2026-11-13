/**
 * RAG 检索质量评测
 *
 * 使用内置标注集计算 Recall@K、HitRate 与 MRR，
 * 为「检索是否真正有效」提供可复现的量化证据。
 */

import { searchKnowledge } from "./index";

interface EvalCase {
  query: string;
  expectedDocIds: string[];
}

export const RAG_EVAL_CASES: EvalCase[] = [
  { query: "小团队开发排期怎么估算", expectedDocIds: ["schedule-and-team"] },
  { query: "RAG 检索增强怎么做", expectedDocIds: ["ai-app-architecture"] },
  {
    query: "教育产品有哪些合规风险",
    expectedDocIds: ["risk-and-compliance", "industry-cases"],
  },
  {
    query: "校园二手交易平台怎么赚钱",
    expectedDocIds: ["business-models", "industry-cases"],
  },
  { query: "如何设计 MVP 并验证需求", expectedDocIds: ["mvp-validation"] },
  {
    query: "Web 应用前端后端数据库怎么选",
    expectedDocIds: ["web-tech-stack"],
  },
  {
    query: "AI 产品交互和视觉设计原则",
    expectedDocIds: ["ui-ux-principles"],
  },
  {
    query: "医疗健康产品要注意什么风险",
    expectedDocIds: ["risk-and-compliance", "industry-cases"],
  },
  { query: "怎么降低大模型 Token 成本", expectedDocIds: ["ai-app-architecture"] },
  {
    query: "电商平台的商业模式和增长",
    expectedDocIds: ["business-models", "industry-cases"],
  },
];

export interface RagEvalCaseResult {
  query: string;
  expectedDocIds: string[];
  retrieved: { docId: string; docTitle: string; score: number }[];
  recall: number;
  hit: boolean;
  reciprocalRank: number;
}

export interface RagEvalSummary {
  topK: number;
  caseCount: number;
  avgRecall: number;
  hitRate: number;
  mrr: number;
  cases: RagEvalCaseResult[];
}

export function runRagEvaluation(topK = 6): RagEvalSummary {
  const cases: RagEvalCaseResult[] = RAG_EVAL_CASES.map((item) => {
    const retrieved = searchKnowledge(item.query, { topK });
    const docIds = retrieved.map((result) => result.docId);
    const hits = new Set(docIds.filter((id) => item.expectedDocIds.includes(id)));
    const recall = hits.size / item.expectedDocIds.length;

    const firstRank = docIds.findIndex((id) => item.expectedDocIds.includes(id));
    const reciprocalRank = firstRank === -1 ? 0 : 1 / (firstRank + 1);

    return {
      query: item.query,
      expectedDocIds: item.expectedDocIds,
      retrieved: retrieved.map((result) => ({
        docId: result.docId,
        docTitle: result.docTitle,
        score: result.score,
      })),
      recall: Number(recall.toFixed(3)),
      hit: hits.size > 0,
      reciprocalRank: Number(reciprocalRank.toFixed(3)),
    };
  });

  const caseCount = cases.length;
  return {
    topK,
    caseCount,
    avgRecall: Number(
      (cases.reduce((sum, item) => sum + item.recall, 0) / caseCount).toFixed(3)
    ),
    hitRate: Number(
      (cases.filter((item) => item.hit).length / caseCount).toFixed(3)
    ),
    mrr: Number(
      (cases.reduce((sum, item) => sum + item.reciprocalRank, 0) / caseCount).toFixed(3)
    ),
    cases,
  };
}
