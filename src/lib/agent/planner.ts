/**
 * Agent 工作流编排器
 *
 * 显式状态机：需求解析 → 知识检索 → 工具推理 → 方案生成 → 质检与架构图。
 * 每个阶段都通过 emit 推送结构化事件，前端据此渲染可观测时间线；
 * 任一阶段失败均有降级路径，只有「方案生成」失败才会中断。
 */

import { generateText } from "ai";
import { getVisionModel, hasVisionModel } from "@/lib/ai";
import {
  generateJSONWithFailover,
  generateTextWithFailover,
  streamTextWithFailover,
  timeoutSignal,
  type ProviderAttempt,
} from "@/lib/ai/failover";
import { listProviders } from "@/lib/ai/providers";
import { searchKnowledge, tokenize } from "@/lib/rag";
import { sanitizeOutput } from "@/lib/safety";
import {
  analysisSchema,
  qualitySchema,
  STAGE_LABELS,
  type AgentEvent,
  type AgentResult,
  type AgentStage,
  type AgentUsage,
  type PlanAnalysis,
  type QualityReport,
  type SourceRef,
  type ToolTrace,
} from "./types";
import {
  buildAnalysisPrompt,
  buildGroundedSystemPrompt,
  buildGroundedUserPrompt,
  buildQualityPrompt,
  buildToolSystemPrompt,
  buildToolUserPrompt,
  fallbackQuality,
  normalizeMermaid,
} from "./prompts";
import {
  estimateSchedule,
  planningTools,
  recommendTechStack,
  riskChecklist,
  summarizeRisks,
  summarizeSchedule,
  summarizeTech,
} from "./tools";

export interface RunAgentInput {
  mode: "tool" | "business";
  painPoint: string;
  demand: string;
  idea: string;
  deep: boolean;
  imageDataUrl?: string | null;
  /** 客户端断连信号，用于中止模型调用 */
  signal?: AbortSignal;
  emit: (event: AgentEvent) => void;
}

const DOMAIN_HINTS: { domain: string; keywords: string[] }[] = [
  { domain: "教育", keywords: ["教育", "学习", "课程", "考试", "题库", "学生", "教师", "校园"] },
  { domain: "医疗健康", keywords: ["医疗", "健康", "问诊", "病历", "医院", "康复", "患者"] },
  { domain: "电商零售", keywords: ["电商", "商城", "购物", "订单", "支付", "商品", "店铺"] },
  { domain: "办公效率", keywords: ["办公", "协作", "文档", "会议", "企业", "效率", "知识库"] },
  { domain: "本地生活", keywords: ["本地", "外卖", "餐饮", "门店", "预约", "到店"] },
  { domain: "社交内容", keywords: ["社交", "社区", "内容", "创作者", "互动", "分享"] },
];

function emptyUsage(): AgentUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function addUsage(target: AgentUsage, usage?: Partial<AgentUsage> | null) {
  if (!usage) return;
  const count = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  const promptTokens = count(usage.promptTokens);
  const completionTokens = count(usage.completionTokens);
  const totalTokens = count(usage.totalTokens);
  target.promptTokens += promptTokens;
  target.completionTokens += completionTokens;
  target.totalTokens += totalTokens > 0 ? totalTokens : promptTokens + completionTokens;
}

/** 无模型可用时的启发式需求解析，保证流程可继续 */
export function heuristicAnalysis(input: {
  painPoint: string;
  demand: string;
  idea: string;
}): PlanAnalysis {
  const raw = [input.painPoint, input.demand, input.idea].filter(Boolean).join("\n");
  const sentences = raw
    .split(/[。！？!?；;\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const domain =
    DOMAIN_HINTS.find((hint) => hint.keywords.some((keyword) => raw.includes(keyword)))?.domain ??
    "通用工具";

  const targetPool = ["学生", "教师", "企业员工", "商家", "开发者", "管理者", "患者", "家长", "自由职业者"];
  const targetUsers = targetPool.filter((user) => raw.includes(user)).slice(0, 4);

  const frequencies = new Map<string, number>();
  for (const token of tokenize(raw)) {
    if (token.length < 2 && !/[\u4e00-\u9fa5]/.test(token)) continue;
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  const keywords = Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([token]) => token);

  return {
    summary: (sentences[0] ?? "用户希望整合零散想法形成完整方案").slice(0, 40),
    domain,
    targetUsers: targetUsers.length ? targetUsers : ["目标用户"],
    painPoints: sentences.slice(0, 4).length ? sentences.slice(0, 4) : ["需求尚未明确"],
    keyFeatures: sentences.slice(0, 6).length ? sentences.slice(0, 6) : ["核心功能待细化"],
    constraints: /预算|成本|经费/.test(raw)
      ? ["存在预算约束"]
      : /时间|周期|上线/.test(raw)
        ? ["存在时间约束"]
        : [],
    keywords: keywords.length ? keywords : [domain, "产品规划"],
  };
}

/** 汇总工具执行结果，控制回填长度 */
function summarizeToolResult(name: string, result: unknown): string {
  if (Array.isArray(result)) {
    return `检索到 ${result.length} 条知识库依据`;
  }
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (typeof record.summary === "string") return record.summary;
    if (Array.isArray(record.items)) {
      return record.items
        .slice(0, 4)
        .map((item) => JSON.stringify(item))
        .join("；")
        .slice(0, 400);
    }
  }
  return JSON.stringify(result ?? "").slice(0, 300);
}

/** 多模态参考图理解 */
async function analyzeImage(imageDataUrl: string, signal?: AbortSignal): Promise<string> {
  const { text } = await generateText({
    model: getVisionModel(),
    temperature: 0.1,
    maxRetries: 1,
    abortSignal: timeoutSignal(30000, signal),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "请客观描述这张参考图：如果是界面截图，说明页面布局与功能；如果是手绘草图或白板，说明其中的模块、流程与文字。只描述看到的内容，不做评价，不超过 300 字。",
          },
          { type: "image", image: imageDataUrl },
        ],
      },
    ],
  });
  return text.trim().slice(0, 1200);
}

async function analyzeRequirements(
  input: RunAgentInput,
  imageInsight: string | null,
  warnings: string[]
): Promise<{ analysis: PlanAnalysis; usage: AgentUsage; attempts: ProviderAttempt[] }> {
  const usage = emptyUsage();
  try {
    // JSON 提示词 + Zod 校验；任一供应商失败或结构不合法都会自动切换
    const result = await generateJSONWithFailover({
      schema: analysisSchema,
      temperature: 0.2,
      timeoutMs: 45000,
      signal: input.signal,
      prompt: `${buildAnalysisPrompt({ ...input, imageInsight })}

只输出一个 JSON 对象，不要输出解释、Markdown 代码围栏或其他文字。JSON 字段必须包含：summary、domain、targetUsers、painPoints、keyFeatures、constraints、keywords。`,
    });
    addUsage(usage, result.usage);
    return { analysis: result.value, usage, attempts: result.attempts };
  } catch (error) {
    warnings.push("需求解析模型调用失败，已使用本地启发式解析。");
    console.warn("[agent] analysis fallback:", error);
    return { analysis: heuristicAnalysis(input), usage, attempts: [] };
  }
}

async function runToolStage(
  input: RunAgentInput,
  analysis: PlanAnalysis,
  sources: SourceRef[],
  emit: (event: AgentEvent) => void,
  warnings: string[]
): Promise<{ trace: ToolTrace[]; findings: string; usage: AgentUsage; attempts: ProviderAttempt[] }> {
  const trace: ToolTrace[] = [];
  let findings = "";
  const usage = emptyUsage();
  let attempts: ProviderAttempt[] = [];

  try {
    const started = Date.now();
    const result = await generateTextWithFailover({
      system: buildToolSystemPrompt(),
      prompt: buildToolUserPrompt(analysis, input.mode, sources),
      tools: planningTools,
      maxSteps: 3,
      temperature: 0.2,
      timeoutMs: 60000,
      requireToolCalls: true,
      signal: input.signal,
    });

    addUsage(usage, result.usage);
    attempts = result.attempts;
    findings = result.value.trim();

    for (const step of result.steps ?? []) {
      for (const call of step.toolCalls ?? []) {
        emit({
          type: "tool",
          name: call.toolName,
          status: "call",
          args: (call.args ?? {}) as Record<string, unknown>,
        });
      }
      for (const toolResult of step.toolResults ?? []) {
        const summary = summarizeToolResult(toolResult.toolName, toolResult.result);
        trace.push({
          name: toolResult.toolName,
          args: (toolResult.args ?? {}) as Record<string, unknown>,
          summary,
          durationMs: Date.now() - started,
        });
        emit({ type: "tool", name: toolResult.toolName, status: "result", summary });
      }
    }

    if (!trace.length) {
      throw new Error("模型未产生工具调用");
    }
  } catch (error) {
    warnings.push("模型工具调用不可用，已切换为内置规则引擎生成工具结论。");
    console.warn("[agent] tool stage fallback:", error);
  }

  // 补齐缺失的工具结论（保证技术选型、排期、风险三件套完整）
  const called = new Set(trace.map((item) => item.name));
  const supplement: ToolTrace[] = [];

  if (!called.has("recommend_tech_stack")) {
    const scenario = `${analysis.domain} ${analysis.summary} ${analysis.keyFeatures.join(" ")}`;
    const rec = recommendTechStack({ scenario, teamSize: 3 });
    supplement.push({
      name: "recommend_tech_stack",
      args: { scenario: analysis.domain, teamSize: 3 },
      summary: summarizeTech(rec),
      durationMs: 0,
    });
  }
  if (!called.has("estimate_schedule")) {
    const plan = estimateSchedule({
      moduleCount: Math.max(analysis.keyFeatures.length, 4),
      teamSize: 3,
      complexity: analysis.constraints.length > 2 ? "high" : "medium",
    });
    supplement.push({
      name: "estimate_schedule",
      args: { moduleCount: analysis.keyFeatures.length || 4, teamSize: 3 },
      summary: summarizeSchedule(plan),
      durationMs: 0,
    });
  }
  if (!called.has("risk_checklist")) {
    const risks = riskChecklist({ mode: input.mode, domain: analysis.domain });
    supplement.push({
      name: "risk_checklist",
      args: { mode: input.mode, domain: analysis.domain },
      summary: summarizeRisks(risks),
      durationMs: 0,
    });
  }

  for (const item of supplement) {
    trace.push(item);
    emit({
      type: "tool",
      name: item.name,
      status: "result",
      summary: `${item.summary}（系统补充）`,
    });
  }

  if (!findings) {
    findings = trace
      .map((item) => `- ${item.name}: ${item.summary}`)
      .join("\n")
      .slice(0, 1200);
  }

  return { trace, findings, usage, attempts };
}

/** 执行完整 Agent 工作流 */
export async function runAgent(input: RunAgentInput): Promise<AgentResult> {
  const { mode, emit } = input;

  // 无任何供应商配置时立即失败，避免请求长时间挂起
  if (!listProviders().length) {
    throw new Error(
      "未配置任何模型供应商，请在环境变量中设置 DEEPSEEK_API_KEY / DASHSCOPE_API_KEY / MOONSHOT_API_KEY / OPENAI_API_KEY 之一"
    );
  }

  const startedAt = Date.now();
  const warnings: string[] = [];
  const safetyFlags: string[] = [];
  const usage = emptyUsage();
  const deep = input.deep;
  let fallbackCount = 0;
  let providerInfo: { id: string; label: string; model: string } | null = null;

  const countFailures = (attempts: ProviderAttempt[]) => {
    fallbackCount += attempts.filter((item) => !item.ok).length;
  };

  const stageStart = (stage: AgentStage, detail?: string) =>
    emit({ type: "stage", stage, status: "start", label: STAGE_LABELS[stage], detail });
  const stageEnd = (stage: AgentStage, started: number, detail?: string) =>
    emit({
      type: "stage",
      stage,
      status: "end",
      label: STAGE_LABELS[stage],
      detail,
      durationMs: Date.now() - started,
    });

  // ===== 多模态参考图理解 =====
  let imageInsight: string | null = null;
  if (input.imageDataUrl) {
    if (hasVisionModel()) {
      stageStart("analyze", "正在识别参考图并解析需求…");
      const imageStart = Date.now();
      try {
        imageInsight = await analyzeImage(input.imageDataUrl, input.signal);
        emit({ type: "stage", stage: "analyze", status: "start", label: "参考图理解", detail: imageInsight.slice(0, 120) });
      } catch (error) {
        warnings.push("参考图识别失败，已忽略图片继续生成。");
        console.warn("[agent] vision failed:", error);
      }
      emit({
        type: "stage",
        stage: "analyze",
        status: "end",
        label: "参考图理解",
        durationMs: Date.now() - imageStart,
      });
    } else {
      warnings.push("未配置 VISION_MODEL，参考图已忽略。多模态能力需在环境变量中配置视觉模型。");
    }
  }

  // ===== 阶段一：需求解析 =====
  const analyzeStart = Date.now();
  stageStart("analyze", deep ? "提取领域、目标用户、核心功能与检索关键词" : "快速模式：本地解析需求");
  let analysis: PlanAnalysis;
  if (deep) {
    const analyzed = await analyzeRequirements(input, imageInsight, warnings);
    analysis = analyzed.analysis;
    addUsage(usage, analyzed.usage);
    countFailures(analyzed.attempts);
  } else {
    analysis = heuristicAnalysis(input);
  }
  emit({ type: "analysis", analysis });
  stageEnd("analyze", analyzeStart, `${analysis.domain} · ${analysis.keyFeatures.length} 项核心功能`);

  // ===== 阶段二：知识检索（RAG） =====
  const retrieveStart = Date.now();
  stageStart("retrieve", "BM25 + 稀疏向量混合召回");
  const query = [
    analysis.summary,
    analysis.domain,
    ...analysis.keywords,
    ...analysis.keyFeatures.slice(0, 4),
    input.painPoint,
    input.demand,
    input.idea,
  ]
    .filter(Boolean)
    .join(" ");

  let sources: SourceRef[] = searchKnowledge(query, { topK: 6 });
  if (!sources.length) {
    sources = searchKnowledge(`${analysis.domain} 项目规划 技术选型 风险`, { topK: 4 });
  }
  emit({ type: "sources", sources });
  stageEnd(
    "retrieve",
    retrieveStart,
    sources.length ? `命中 ${sources.length} 条依据 · 最高相关度 ${sources[0]?.score ?? 0}` : "未命中高相关度资料"
  );

  // ===== 阶段三：工具推理 =====
  let tools: ToolTrace[] = [];
  let toolFindings = "";
  if (deep) {
    const toolsStart = Date.now();
    stageStart("tools", "Function Calling：知识检索 / 技术选型 / 排期估算 / 风险清单");
    const result = await runToolStage(input, analysis, sources, emit, warnings);
    tools = result.trace;
    toolFindings = result.findings;
    addUsage(usage, result.usage);
    countFailures(result.attempts);
    stageEnd("tools", toolsStart, `完成 ${tools.length} 个工具调用`);
  } else {
    emit({ type: "stage", stage: "tools", status: "skip", label: STAGE_LABELS.tools, detail: "快速模式跳过工具推理" });
  }

  // ===== 阶段四：方案生成（流式） =====
  const generateStart = Date.now();
  stageStart("generate", deep ? "基于检索依据与工具结论生成完整方案" : "快速模式：单次流式生成");
  const system = buildGroundedSystemPrompt(mode);
  const prompt = buildGroundedUserPrompt({
    ...input,
    analysis,
    sources,
    tools,
    imageInsight,
  });

  let fullContent = "";
  const streamResult = await streamTextWithFailover({
    system,
    prompt,
    temperature: mode === "tool" ? 0.65 : 0.7,
    timeoutMs: 150000,
    signal: input.signal,
    onToken: (delta) => emit({ type: "token", delta }),
    onProvider: (provider, failures) => {
      providerInfo = { id: provider.id, label: provider.label, model: provider.model };
      emit({
        type: "provider",
        provider: provider.id,
        label: provider.label,
        model: provider.model,
        fallbacks: fallbackCount + failures,
      });
    },
    onFailure: (attempt) => {
      console.warn(`[agent] 供应商 ${attempt.label} 调用失败，尝试切换：${attempt.error}`);
    },
  });

  addUsage(usage, streamResult.usage);
  countFailures(streamResult.attempts);
  fullContent = streamResult.value;
  providerInfo = {
    id: streamResult.provider.id,
    label: streamResult.provider.label,
    model: streamResult.provider.model,
  };

  const sanitized = sanitizeOutput(fullContent, { requireDisclaimer: true });
  safetyFlags.push(...sanitized.flags);
  fullContent = sanitized.content;
  if (!fullContent.trim()) {
    throw new Error("AI 未返回有效内容，请稍后重试或检查模型配置");
  }
  stageEnd("generate", generateStart, `${fullContent.length} 字`);

  // ===== 阶段五：质检 + 架构图 =====
  const qualityStart = Date.now();
  stageStart("quality", "五维质量评分与架构图生成");
  let quality: QualityReport | null = null;
  if (deep) {
    try {
      const result = await generateJSONWithFailover({
        schema: qualitySchema,
        temperature: 0.2,
        timeoutMs: 60000,
        signal: input.signal,
        prompt: `${buildQualityPrompt(fullContent, analysis)}

只输出一个 JSON 对象，不要输出解释或 Markdown 代码围栏。JSON 字段必须包含：dimensions（数组，元素含 name、score、comment）、suggestions（字符串数组）、mermaid（字符串）。`,
      });
      addUsage(usage, result.usage);
      countFailures(result.attempts);

      quality = {
        ...result.value,
        mermaid: normalizeMermaid(result.value.mermaid, analysis),
      };
    } catch (error) {
      warnings.push("质检模型调用失败，已使用本地启发式评分。");
      console.warn("[agent] quality fallback:", error);
    }
  }
  if (!quality) quality = fallbackQuality(fullContent, analysis);

  const diagram = normalizeMermaid(quality.mermaid, analysis);
  emit({ type: "quality", quality });
  emit({ type: "diagram", mermaid: diagram });
  stageEnd(
    "quality",
    qualityStart,
    `综合 ${Math.round(quality.dimensions.reduce((sum, item) => sum + item.score, 0) / quality.dimensions.length)} 分`
  );

  // 汇总本次运行的供应商与切换次数
  if (providerInfo) {
    emit({
      type: "provider",
      provider: providerInfo.id,
      label: providerInfo.label,
      model: providerInfo.model,
      fallbacks: fallbackCount,
    });
    if (fallbackCount > 0) {
      warnings.push(
        `主供应商调用异常，已自动切换 ${fallbackCount} 次，最终使用 ${providerInfo.label}（${providerInfo.model}）。`
      );
    }
  }

  for (const warning of warnings) emit({ type: "warning", message: warning });

  const publicResult = {
    content: fullContent,
    analysis,
    sources,
    tools,
    quality,
    diagram,
    imageInsight,
    deep,
    usage,
    latencyMs: Date.now() - startedAt,
    warnings,
    provider: providerInfo?.id ?? "",
    model: providerInfo?.model ?? "",
    fallbacks: fallbackCount,
  };

  emit({ type: "done", data: publicResult });

  return {
    ...publicResult,
    safetyFlags,
  };
}
