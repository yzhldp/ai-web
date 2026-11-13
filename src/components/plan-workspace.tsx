"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Wrench,
  Briefcase,
  Wand2,
  Send,
  ListChecks,
  Sparkles,
  ImagePlus,
  X,
  Square,
  ShieldCheck,
  BookOpen,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Markdown } from "@/components/markdown";
import { CommentSection } from "@/components/comment-section";
import {
  AgentTimeline,
  createInitialStages,
  type StageView,
} from "@/components/agent-timeline";
import { AnalysisPanel, SourceList, ToolTraceList } from "@/components/source-list";
import { QualityReportView } from "@/components/quality-report";
import { PlanDiagram } from "@/components/plan-diagram";
import { KnowledgePanel } from "@/components/knowledge-panel";
import type {
  AgentEvent,
  AgentPublicResult,
  AgentUsage,
  PlanAnalysis,
  QualityReport,
  SourceRef,
  ToolTrace,
} from "@/lib/agent/types";

export type PlanMode = "tool" | "business";

/** 模式配置 */
const MODE_CONFIG = {
  tool: {
    name: "工具创新",
    subtitle: "软件开发规划",
    icon: Wrench,
    gradient: "from-violet-500 to-purple-500",
    desc: "将零散想法整合为可落地的软件开发方案",
    sample: {
      painPoint: "社团活动报名靠群里接龙，统计混乱、容易漏人，也看不到名额剩余。",
      demand: "希望有一个在线报名与名额管理工具，支持导出名单和自动提醒。",
      idea: "能不能让 AI 根据活动主题自动生成报名文案和海报？",
    },
  },
  business: {
    name: "创业创新",
    subtitle: "创业项目规划",
    icon: Briefcase,
    gradient: "from-fuchsia-500 to-pink-500",
    desc: "将创意点梳理为可落地的创业项目方案",
    sample: {
      painPoint: "校园二手教材买卖信息分散在多个群，价格不透明、交易信任度低。",
      demand: "想做一个校内实名认证的二手教材交易平台，支持按课程检索。",
      idea: "用 AI 自动估价并生成商品描述，降低发布门槛。",
    },
  },
} as const;

type TabKey = "plan" | "diagram" | "quality" | "sources" | "knowledge";

/**
 * 方案工作台
 * 左侧输入 + 右侧 Agent 可观测输出（方案 / 架构图 / 质检 / 依据 / 知识库）
 */
export function PlanWorkspace({ mode }: { mode: PlanMode }) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  // 输入
  const [painPoint, setPainPoint] = useState("");
  const [demand, setDemand] = useState("");
  const [idea, setIdea] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [deep, setDeep] = useState(true);

  // 输出
  const [content, setContent] = useState("");
  const [stages, setStages] = useState<StageView[]>(createInitialStages);
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null);
  const [sources, setSources] = useState<SourceRef[]>([]);
  const [tools, setTools] = useState<ToolTrace[]>([]);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [diagram, setDiagram] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [usage, setUsage] = useState<AgentUsage | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);

  const [tab, setTab] = useState<TabKey>("plan");
  const [generating, setGenerating] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [extraInput, setExtraInput] = useState("");

  // 流式渲染节流与中断控制
  const fullContentRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const toolStartedAtRef = useRef<Record<string, number>>({});

  const flushContent = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setContent(fullContentRef.current);
  }, []);

  /** Token 节流：合并 60ms 内的增量，避免逐字符重渲染整页 */
  const appendToken = useCallback((delta: string) => {
    fullContentRef.current += delta;
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        setContent(fullContentRef.current);
        flushTimerRef.current = null;
      }, 60);
    }
  }, []);

  const updateStage = useCallback(
    (stage: StageView["stage"], patch: Partial<StageView>) => {
      setStages((prev) =>
        prev.map((item) => (item.stage === stage ? { ...item, ...patch } : item))
      );
    },
    []
  );

  /** 保存方案及 AI 元数据 */
  const savePlan = useCallback(
    async (data: AgentPublicResult) => {
      try {
        const res = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            painPoint,
            demand,
            idea,
            content: data.content,
            analysis: data.analysis ? JSON.stringify(data.analysis) : undefined,
            sources: JSON.stringify(data.sources),
            quality: data.quality ? JSON.stringify(data.quality) : undefined,
            diagram: data.diagram,
            hasImage: Boolean(image),
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "方案保存失败");
        setPlanId(payload.plan.id);
        toast.success("方案已生成并保存");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "方案保存失败");
      }
    },
    [mode, painPoint, demand, idea, image]
  );

  /** 处理一条 SSE 事件 */
  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case "stage": {
          const status =
            event.status === "start"
              ? "running"
              : event.status === "end"
                ? "done"
                : event.status === "skip"
                  ? "skip"
                  : "error";
          updateStage(event.stage, {
            status,
            detail: event.detail,
            durationMs: event.durationMs,
          });
          break;
        }
        case "analysis":
          setAnalysis(event.analysis);
          break;
        case "sources":
          setSources(event.sources);
          break;
        case "tool":
          if (event.status === "call") {
            toolStartedAtRef.current[event.name] = Date.now();
          } else {
            const started = toolStartedAtRef.current[event.name];
            setTools((prev) => [
              ...prev,
              {
                name: event.name,
                args: (event.args as Record<string, unknown>) ?? {},
                summary: event.summary ?? "",
                durationMs: started ? Date.now() - started : 0,
              },
            ]);
          }
          break;
        case "token":
          appendToken(event.delta);
          break;
        case "quality":
          setQuality(event.quality);
          break;
        case "diagram":
          setDiagram(event.mermaid);
          break;
        case "warning":
          setWarnings((prev) => (prev.includes(event.message) ? prev : [...prev, event.message]));
          toast.warning(event.message);
          break;
        case "done": {
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          fullContentRef.current = event.data.content;
          setContent(event.data.content);
          setAnalysis(event.data.analysis);
          setSources(event.data.sources);
          setTools(event.data.tools);
          setQuality(event.data.quality);
          setDiagram(event.data.diagram);
          setUsage(event.data.usage);
          setLatencyMs(event.data.latencyMs);
          setWarnings(event.data.warnings);
          setStages((prev) =>
            prev.map((item) =>
              item.status === "running" || item.status === "pending"
                ? { ...item, status: "done" }
                : item
            )
          );
          void savePlan(event.data);
          break;
        }
        case "error":
          throw new Error(event.message);
      }
    },
    [appendToken, savePlan, updateStage]
  );

  /** 生成方案（Agent SSE） */
  async function handleGenerate() {
    if (!painPoint.trim() && !demand.trim() && !idea.trim()) {
      toast.error("请至少填写一项内容");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setContent("");
    setPlanId(null);
    setStages(createInitialStages());
    setAnalysis(null);
    setSources([]);
    setTools([]);
    setQuality(null);
    setDiagram("");
    setWarnings([]);
    setUsage(null);
    setLatencyMs(0);
    setTab("plan");
    fullContentRef.current = "";
    toolStartedAtRef.current = {};

    try {
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          painPoint,
          demand,
          idea,
          deep,
          image,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "AI 生成失败，请稍后重试");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const dataLine = frame
            .split("\n")
            .find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (!payload) continue;
          handleEvent(JSON.parse(payload) as AgentEvent);
        }
      }

      if (buffer.trim().startsWith("data:")) {
        const payload = buffer.trim().slice(5).trim();
        if (payload) handleEvent(JSON.parse(payload) as AgentEvent);
      }
      flushContent();
    } catch (err) {
      setStages((prev) =>
        prev.map((item) =>
          item.status === "running"
            ? {
                ...item,
                status: controller.signal.aborted ? "skip" : "error",
                detail: controller.signal.aborted ? "已停止生成" : "执行失败",
              }
            : item
        )
      );
      if (controller.signal.aborted) {
        toast.info("已停止生成");
        flushContent();
      } else {
        toast.error(err instanceof Error ? err.message : "生成失败");
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  /** 迭代优化当前方案 */
  async function handleIterate() {
    if (!extraInput.trim()) {
      toast.error("请输入补充需求");
      return;
    }
    if (!planId) {
      toast.error("请先生成方案");
      return;
    }

    setGenerating(true);
    const previous = content;
    fullContentRef.current = "";
    setContent("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "iterate",
          mode,
          messages: [{ role: "user", content: `补充需求：${extraInput}` }],
          context: previous,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "AI 生成失败，请稍后重试");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setContent(full);
      }
      fullContentRef.current = full;

      const updateRes = await fetch(`/api/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: full }),
      });
      if (updateRes.ok) {
        toast.success("方案迭代完成");
      }
      setExtraInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "迭代失败");
      if (!fullContentRef.current) setContent(previous);
    } finally {
      setGenerating(false);
    }
  }

  /** 参考图上传：压缩后转为 Data URL */
  async function handleImageFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("图片不能超过 8MB");
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const maxSide = 1280;
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("图片处理失败"));
              return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          };
          img.onerror = () => reject(new Error("图片读取失败"));
          img.src = String(reader.result);
        };
        reader.onerror = () => reject(new Error("图片读取失败"));
        reader.readAsDataURL(file);
      });
      setImage(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "图片处理失败");
    }
  }

  function fillSample() {
    setPainPoint(config.sample.painPoint);
    setDemand(config.sample.demand);
    setIdea(config.sample.idea);
  }

  const hasResult = Boolean(content || analysis || sources.length || quality);

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：输入区 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border bg-white/70 p-6 backdrop-blur"
        >
          <div className="mb-5 flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient} text-white`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">{config.name}</h2>
              <p className="text-sm text-muted-foreground">{config.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={fillSample}
              className="shrink-0 text-xs text-primary hover:underline"
            >
              填入示例
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${mode}-pain`}>痛点描述</Label>
              <Textarea
                id={`${mode}-pain`}
                rows={3}
                placeholder="你遇到了什么困扰或问题？"
                value={painPoint}
                onChange={(e) => setPainPoint(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${mode}-demand`}>需求描述</Label>
              <Textarea
                id={`${mode}-demand`}
                rows={3}
                placeholder="你希望实现什么功能或目标？"
                value={demand}
                onChange={(e) => setDemand(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${mode}-idea`}>奇思妙想</Label>
              <Textarea
                id={`${mode}-idea`}
                rows={3}
                placeholder="你有哪些天马行空的想法？"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
              />
            </div>

            {/* 多模态参考图 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>参考图（可选）</Label>
                <span className="text-[11px] text-muted-foreground">界面截图 / 手绘草图 / 白板照片</span>
              </div>
              {image ? (
                <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="参考图预览" className="h-20 w-20 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      已添加参考图，生成时由视觉模型识别其中的界面或草图信息。
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-7 gap-1 px-2 text-xs text-destructive"
                      onClick={() => setImage(null)}
                    >
                      <X className="h-3 w-3" />
                      移除
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  <ImagePlus className="h-4 w-4" />
                  上传参考图，让 AI 理解草图
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void handleImageFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            {/* 深度模式开关 */}
            <button
              type="button"
              onClick={() => setDeep((value) => !value)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-left"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  深度 Agent 模式
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  需求解析 → RAG 检索 → 工具调用 → 方案生成 → 质检；关闭后为单次快速生成
                </p>
              </div>
              <span
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  deep ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    deep ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>

            <Button
              onClick={generating ? () => abortRef.current?.abort() : handleGenerate}
              className={`w-full gap-2 ${
                generating
                  ? "bg-muted-foreground text-white"
                  : `bg-gradient-to-r ${config.gradient} text-white`
              }`}
            >
              {generating ? (
                <>
                  <Square className="h-4 w-4" />
                  停止生成
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  创新合成
                </>
              )}
            </Button>

            <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
              {["Agent 工作流", "RAG 引用", "Function Calling", "多模态", "内容安全"].map(
                (item) => (
                  <span key={item} className="rounded-full bg-muted px-2 py-0.5">
                    {item}
                  </span>
                )
              )}
            </div>
          </div>
        </motion.div>

        {/* 右侧：输出区 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col rounded-2xl border bg-white/70 p-6 backdrop-blur"
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient} text-white`}
            >
              <ListChecks className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">Agent 工作台</h2>
              <p className="text-sm text-muted-foreground">{config.desc}</p>
            </div>
            {hasResult && (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">
                已完成
              </span>
            )}
          </div>

          <AgentTimeline stages={stages} />

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as TabKey)}
            className="mt-4 flex flex-1 flex-col"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="plan" className="gap-1 text-xs">
                <ListChecks className="h-3.5 w-3.5" />
                方案
              </TabsTrigger>
              <TabsTrigger value="diagram" className="gap-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                架构图
              </TabsTrigger>
              <TabsTrigger value="quality" className="gap-1 text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                质检
              </TabsTrigger>
              <TabsTrigger value="sources" className="gap-1 text-xs">
                <BookOpen className="h-3.5 w-3.5" />
                依据
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-1 text-xs">
                <Database className="h-3.5 w-3.5" />
                知识库
              </TabsTrigger>
            </TabsList>

            <TabsContent value="plan" className="mt-3 flex-1">
              <div className="h-[520px] overflow-y-auto rounded-lg border bg-background p-4">
                {content ? (
                  <Markdown content={content} />
                ) : (
                  <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-muted-foreground">
                    <Icon className="mb-3 h-10 w-10 opacity-30" />
                    <p className="text-sm">
                      {generating ? "Agent 正在工作，请稍候..." : "方案将在这里流式展示"}
                    </p>
                  </div>
                )}
                {generating && content && (
                  <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary" />
                )}
              </div>

              {/* 迭代输入 */}
              <div className="mt-3 flex gap-2">
                <Textarea
                  rows={2}
                  className="flex-1"
                  placeholder="补充需求，迭代优化当前方案..."
                  value={extraInput}
                  onChange={(e) => setExtraInput(e.target.value)}
                />
                <Button
                  onClick={handleIterate}
                  disabled={generating || !planId}
                  className="h-auto"
                >
                  <Send className="h-4 w-4" />
                  发送
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="diagram" className="mt-3">
              <PlanDiagram chart={diagram} />
            </TabsContent>

            <TabsContent value="quality" className="mt-3">
              <QualityReportView
                quality={quality}
                usage={usage}
                latencyMs={latencyMs}
                warnings={warnings}
              />
            </TabsContent>

            <TabsContent value="sources" className="mt-3">
              <div className="h-[520px] space-y-5 overflow-y-auto pr-1">
                <section>
                  <h3 className="mb-2 text-sm font-semibold">需求解析</h3>
                  <AnalysisPanel analysis={analysis} />
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">工具调用轨迹</h3>
                  <ToolTraceList tools={tools} />
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">知识库检索依据</h3>
                  <SourceList sources={sources} />
                </section>
              </div>
            </TabsContent>

            <TabsContent value="knowledge" className="mt-3">
              <div className="h-[520px] overflow-y-auto pr-1">
                <KnowledgePanel />
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* 评论区 */}
      <CommentSection planId={planId} />
    </div>
  );
}
