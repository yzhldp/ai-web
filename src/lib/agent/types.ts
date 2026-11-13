import { z } from "zod";
import type { ProviderAttempt } from "@/lib/ai/failover";

/** 需求解析阶段的结构化输出 */
export const analysisSchema = z.object({
  summary: z.string().describe("用一句话概括用户想做的项目"),
  domain: z.string().describe("所属行业或领域，例如 教育、电商、办公效率"),
  targetUsers: z.array(z.string()).max(6).describe("目标用户群体"),
  painPoints: z.array(z.string()).max(8).describe("提炼后的核心痛点"),
  keyFeatures: z.array(z.string()).max(10).describe("建议的核心功能"),
  constraints: z.array(z.string()).max(8).describe("已知的约束条件，如预算、团队、时间"),
  keywords: z.array(z.string()).max(12).describe("用于知识库检索的关键词"),
});

export type PlanAnalysis = z.infer<typeof analysisSchema>;

/** 方案质检 + 架构图（合并为一次结构化调用，降低延迟与成本） */
export const qualitySchema = z.object({
  dimensions: z
    .array(
      z.object({
        name: z.string().describe("评估维度名称"),
        score: z.number().min(0).max(100).describe("0-100 分"),
        comment: z.string().describe("一句话点评"),
      })
    )
    .min(4)
    .max(6)
    .describe("需求覆盖度、技术可行性、落地可执行性、创新性、风险完整性"),
  suggestions: z.array(z.string()).max(6).describe("可执行的改进建议"),
  mermaid: z
    .string()
    .describe(
      "Mermaid flowchart 源码，描述方案的核心模块与数据流，必须以 flowchart TD 开头，不要使用 Markdown 代码围栏"
    ),
});

export type QualityReport = z.infer<typeof qualitySchema>;

export type AgentStage = "analyze" | "retrieve" | "tools" | "generate" | "quality";

export type StageStatus = "start" | "end" | "error" | "skip";

export const STAGE_LABELS: Record<AgentStage, string> = {
  analyze: "需求解析",
  retrieve: "知识检索",
  tools: "工具推理",
  generate: "方案生成",
  quality: "质检与架构图",
};

export interface SourceRef {
  id: string;
  docId: string;
  docTitle: string;
  category: string;
  heading: string;
  content: string;
  score: number;
  cosine: number;
  bm25: number;
  matched?: string[];
}

export interface ToolTrace {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  durationMs: number;
}

export interface AgentUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 一次 Agent 运行的完整结果 */
export interface AgentResult {
  content: string;
  analysis: PlanAnalysis | null;
  sources: SourceRef[];
  tools: ToolTrace[];
  quality: QualityReport | null;
  diagram: string;
  imageInsight: string | null;
  deep: boolean;
  usage: AgentUsage;
  latencyMs: number;
  safetyFlags: string[];
  warnings: string[];
  /** 最终成功调用的供应商 */
  provider: string;
  model: string;
  /** 本次运行中自动切换供应商的次数 */
  fallbacks: number;
}

/** 流式事件协议（SSE 的 data 字段） */
export type AgentEvent =
  | {
      type: "stage";
      stage: AgentStage;
      status: StageStatus;
      label: string;
      detail?: string;
      durationMs?: number;
    }
  | { type: "analysis"; analysis: PlanAnalysis }
  | { type: "sources"; sources: SourceRef[] }
  | { type: "tool"; name: string; status: "call" | "result"; args?: unknown; summary?: string }
  | { type: "token"; delta: string }
  | { type: "provider"; provider: string; label: string; model: string; fallbacks: number }
  | { type: "quality"; quality: QualityReport }
  | { type: "diagram"; mermaid: string }
  | { type: "warning"; message: string }
  | { type: "done"; data: AgentPublicResult }
  | { type: "error"; message: string };

export interface AgentPublicResult {
  content: string;
  analysis: PlanAnalysis | null;
  sources: SourceRef[];
  tools: ToolTrace[];
  quality: QualityReport | null;
  diagram: string;
  imageInsight: string | null;
  deep: boolean;
  usage: AgentUsage;
  latencyMs: number;
  warnings: string[];
  provider: string;
  model: string;
  fallbacks: number;
  attempts?: ProviderAttempt[];
}
