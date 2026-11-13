/**
 * Agent 各阶段提示词
 * 统一约束：结构化输出、中文、引用来源、安全边界、免责声明。
 */

import { SAFETY_SYSTEM_SUFFIX } from "@/lib/safety";
import type { PlanAnalysis, QualityReport, SourceRef, ToolTrace } from "./types";

const MODE_NAME = {
  tool: "软件开发规划",
  business: "创业项目规划",
} as const;

export const TOOL_STRUCTURE = `## 一、项目总览
## 二、痛点清单
## 三、目标用户
## 四、核心功能
## 五、扩展功能
## 六、模块划分
## 七、技术选型
## 八、开发排期
## 九、风险难点
## 十、验收标准`;

export const BUSINESS_STRUCTURE = `## 一、项目定位
## 二、痛点与价值
## 三、目标人群
## 四、产品形态
## 五、差异化
## 六、竞品简述
## 七、商业模式
## 八、落地计划
## 九、风险对策`;

export function structureOf(mode: "tool" | "business") {
  return mode === "tool" ? TOOL_STRUCTURE : BUSINESS_STRUCTURE;
}

/** 阶段一：需求解析 */
export function buildAnalysisPrompt(input: {
  mode: "tool" | "business";
  painPoint: string;
  demand: string;
  idea: string;
  imageInsight?: string | null;
}) {
  const imagePart = input.imageInsight
    ? `\n\n参考图理解结果（来自多模态模型的客观描述）：\n${input.imageInsight}`
    : "";
  return `请分析下面这份零散的创业/产品素材，提取结构化信息，用于后续生成${MODE_NAME[input.mode]}。

痛点描述：
${input.painPoint || "（未填写）"}

需求描述：
${input.demand || "（未填写）"}

奇思妙想：
${input.idea || "（未填写）"}${imagePart}

要求：
1. summary 用一句话概括项目，不超过 40 字；
2. domain 给出最贴近的行业领域；
3. 关键词要覆盖行业、场景、技术、商业模式四类，便于后续检索；
4. 不要编造用户未提及的强约束。`;
}

/** 阶段三：工具推理（Function Calling） */
export function buildToolSystemPrompt() {
  return `你是项目规划 Agent 的调研助手。你需要围绕用户需求调用工具，收集中立、可核实的规划依据。

工具使用规则：
1. 至少调用 recommend_tech_stack、estimate_schedule、risk_checklist 三个工具；
2. 需要行业最佳实践或事实依据时调用 search_knowledge_base；
3. 调用完成后，用不超过 300 字总结工具结论，分点列出关键技术选型、工期与高风险项；
4. 不要输出完整方案，只输出调研结论。${SAFETY_SYSTEM_SUFFIX}`;
}

export function buildToolUserPrompt(analysis: PlanAnalysis, mode: "tool" | "business", sources: SourceRef[]) {
  const sourceBrief = sources
    .slice(0, 4)
    .map((source, index) => `[${index + 1}] ${source.docTitle}·${source.heading}：${source.content.slice(0, 160)}`)
    .join("\n");
  return `项目模式：${MODE_NAME[mode]}
需求摘要：${analysis.summary}
所属领域：${analysis.domain}
目标用户：${analysis.targetUsers.join("、") || "未明确"}
核心功能：${analysis.keyFeatures.join("、") || "未明确"}
约束条件：${analysis.constraints.join("、") || "未明确"}
知识库已有参考：
${sourceBrief || "（暂无）"}

请调用工具完成调研并给出结论。`;
}

/** 阶段四：带依据的方案生成 */
export function buildGroundedSystemPrompt(mode: "tool" | "business") {
  return `你是一位资深的${mode === "tool" ? "软件产品架构师与技术规划专家" : "创业顾问与商业分析师"}，擅长把零散素材整合为可落地的${MODE_NAME[mode]}。

输出要求：
1. 严格使用 Markdown，且必须完整包含以下章节：${structureOf(mode).replace(/\n/g, "；")}；
2. 内容具体、可执行，避免空话；技术选型、排期、商业模式都要给出可验证的细节；
3. 【知识库引用】当使用了参考资料时，在相应句子末尾标注 [编号]（如 [2]），编号必须来自提供的参考列表，最多引用 6 条，不得编造来源；
4. 【工具结论】技术选型、排期与风险需与工具结论保持一致，如有调整需说明理由；
5. 【参考图】若提供了图片理解结果，需在「项目总览」中说明如何回应图中信息；
6. 若参考资料不足以支撑某个结论，明确标注「推测」而不是编造数据；
7. 语言使用中文，全文控制在 1200-2200 字；
8. 文末追加一行：> 本方案由 AI 生成，仅为创意参考，不代表绝对可行性。${SAFETY_SYSTEM_SUFFIX}`;
}

export function buildGroundedUserPrompt(input: {
  mode: "tool" | "business";
  painPoint: string;
  demand: string;
  idea: string;
  analysis: PlanAnalysis;
  sources: SourceRef[];
  tools: ToolTrace[];
  imageInsight?: string | null;
}) {
  const references = input.sources.length
    ? input.sources
        .map(
          (source, index) =>
            `[${index + 1}] 来源：${source.docTitle} · ${source.heading}（相关度 ${source.score}）\n${source.content.slice(0, 420)}`
        )
        .join("\n\n")
    : "（本轮未检索到高相关度资料，请基于通用经验作答并标注推测）";

  const toolNotes = input.tools.length
    ? input.tools.map((tool) => `- ${tool.name}：${tool.summary}`).join("\n")
    : "（无工具结论）";

  const imagePart = input.imageInsight
    ? `\n\n【参考图理解】\n${input.imageInsight}`
    : "";

  return `【用户原始素材】
痛点：${input.painPoint || "未填写"}
需求：${input.demand || "未填写"}
奇思妙想：${input.idea || "未填写"}

【结构化需求解析】
${JSON.stringify(input.analysis, null, 2)}

【知识库检索结果（用于引用）】
${references}

【工具调研结论】
${toolNotes}${imagePart}

请基于以上材料输出完整方案。`;
}

/** 阶段五：质检 + 架构图 */
export function buildQualityPrompt(content: string, analysis: PlanAnalysis) {
  return `你是严格的方案评审专家。请对下面这份项目规划方案做质检，并从 0 到 100 打分。

评估维度（必须正好 5 个）：
1. 需求覆盖度：是否回应了痛点、需求与奇思妙想；
2. 技术可行性：技术选型与架构是否合理；
3. 落地可执行性：排期、里程碑、验收标准是否可执行；
4. 创新性：是否有差异化与亮点；
5. 风险完整性：风险识别与应对是否充分。

同时输出一段 Mermaid flowchart 源码：
- 必须以「flowchart TD」开头；
- 用 4-8 个节点描述方案的核心模块与数据流；
- 节点文本使用中文，避免特殊字符与 Markdown 围栏；
- 不要把源码包在 \`\`\` 中。

【需求解析】
${JSON.stringify(analysis)}

【待质检方案】
${content.slice(0, 12000)}`;
}

/** 质检失败时的启发式评分，保证功能可用 */
export function fallbackQuality(content: string, analysis: PlanAnalysis): QualityReport {
  const sections = (content.match(/^##\s+/gm) ?? []).length;
  const hasSchedule = /排期|里程碑|工期|阶段/.test(content);
  const hasTech = /技术选型|架构|技术栈|前端|后端/.test(content);
  const hasRisk = /风险|合规|隐私/.test(content);
  const citations = (content.match(/\[\d+\]/g) ?? []).length;
  const lengthScore = Math.min(100, Math.round((content.length / 1800) * 100));

  const dimensions = [
    {
      name: "需求覆盖度",
      score: Math.min(95, 55 + sections * 3 + (analysis.keyFeatures.length ? 8 : 0)),
      comment: `识别到 ${analysis.keyFeatures.length} 个核心功能，章节 ${sections} 个。`,
    },
    {
      name: "技术可行性",
      score: hasTech ? 82 : 62,
      comment: hasTech ? "给出了明确的技术选型与架构说明。" : "技术选型描述较少，建议补充。",
    },
    {
      name: "落地可执行性",
      score: hasSchedule ? 80 : 60,
      comment: hasSchedule ? "包含排期或里程碑，具备执行基础。" : "缺少排期与验收标准。",
    },
    {
      name: "创新性",
      score: Math.min(90, 60 + citations * 4 + (analysis.keyFeatures.length > 4 ? 6 : 0)),
      comment: citations ? `引用了 ${citations} 处知识库依据。` : "建议增加差异化亮点与依据。",
    },
    {
      name: "风险完整性",
      score: hasRisk ? 78 : 58,
      comment: hasRisk ? "覆盖了主要风险与应对措施。" : "建议补充风险与合规章节。",
    },
  ];

  return {
    dimensions,
    suggestions: [
      hasSchedule ? "为关键里程碑补充明确的负责人" : "补充开发排期、里程碑与验收标准",
      hasRisk ? "补充外部依赖失效时的降级方案" : "补充技术、市场与合规风险及应对措施",
      citations ? "将引用编号与正文结论一一对应" : "结合知识库补充可核实的数据或案例依据",
    ],
    mermaid: buildFallbackDiagram(analysis),
  };
}

/** 基于解析结果生成兜底架构图 */
export function buildFallbackDiagram(analysis: PlanAnalysis): string {
  const features = analysis.keyFeatures.length
    ? analysis.keyFeatures.slice(0, 5)
    : ["核心功能"];
  const lines = ["flowchart TD", "  U[目标用户] --> P[产品入口]"];
  features.forEach((feature, index) => {
    const text = feature.replace(/[\[\]()"`]/g, "").slice(0, 18) || `功能${index + 1}`;
    lines.push(`  P --> F${index + 1}[${text}]`);
  });
  lines.push("  P --> A[AI 规划引擎]");
  lines.push("  A --> K[知识库检索]");
  lines.push("  A --> T[工具调用]");
  lines.push("  A --> Q[质量校验]");
  lines.push("  F1 --> D[(数据存储)]");
  return lines.join("\n");
}

/** 清洗模型返回的 Mermaid 源码 */
export function normalizeMermaid(raw: string, analysis: PlanAnalysis): string {
  const cleaned = raw
    .replace(/^```(?:mermaid)?/i, "")
    .replace(/```$/i, "")
    .replace(/\r/g, "")
    .trim();

  if (/^(flowchart|graph)\s+(TD|LR|TB|BT|RL)/i.test(cleaned)) {
    return cleaned.slice(0, 4000);
  }
  return buildFallbackDiagram(analysis);
}
