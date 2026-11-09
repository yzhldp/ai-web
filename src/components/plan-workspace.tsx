"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Wrench, Briefcase, Wand2, Send, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/markdown";
import { CommentSection } from "@/components/comment-section";

export type PlanMode = "tool" | "business";

/** 模式配置 */
const MODE_CONFIG = {
  tool: {
    name: "工具创新",
    subtitle: "软件开发规划",
    icon: Wrench,
    gradient: "from-violet-500 to-purple-500",
    desc: "将零散想法整合为可落地的软件开发方案",
    steps: [
      "填写「痛点、需求、奇思妙想」三个输入框",
      "点击「创新合成」按钮，AI 开始生成规划",
      "右侧实时查看流式输出的完整方案",
      "在底部补充需求，迭代优化当前方案",
    ],
  },
  business: {
    name: "创业创新",
    subtitle: "创业项目规划",
    icon: Briefcase,
    gradient: "from-fuchsia-500 to-pink-500",
    desc: "将创意点梳理为可落地的创业项目方案",
    steps: [
      "填写「痛点、需求、奇思妙想」三个输入框",
      "点击「创新合成」按钮，AI 开始生成规划",
      "右侧实时查看流式输出的完整方案",
      "在底部补充需求，迭代优化当前方案",
    ],
  },
} as const;

/**
 * 方案工作台（工具创新 / 创业创新 共用，结构一致，模式不同）
 * 左侧输入区 + 右侧输出区 + 下方评论区
 */
export function PlanWorkspace({ mode }: { mode: PlanMode }) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  // 输入区状态
  const [painPoint, setPainPoint] = useState("");
  const [demand, setDemand] = useState("");
  const [idea, setIdea] = useState("");

  // 输出区状态
  const [content, setContent] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [extraInput, setExtraInput] = useState("");
  const [generating, setGenerating] = useState(false);

  /**
   * 通用流式请求：调用 /api/chat 并逐块读取纯文本流
   */
  async function streamChat(params: {
    action: "generate" | "iterate";
    messages: { role: "user" | "assistant"; content: string }[];
    context?: string;
  }) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, mode }),
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || "AI 生成失败，请稍后重试");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    // 逐块读取流式输出，实时更新界面
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      setContent(full);
    }
    return full;
  }

  /** 生成方案 */
  async function handleGenerate() {
    if (!painPoint.trim() && !demand.trim() && !idea.trim()) {
      toast.error("请至少填写一项内容");
      return;
    }
    setGenerating(true);
    setContent("");
    setPlanId(null);
    try {
      const full = await streamChat({
        action: "generate",
        messages: [
          {
            role: "user",
            content: `痛点描述：\n${painPoint}\n\n需求描述：\n${demand}\n\n奇思妙想：\n${idea}`,
          },
        ],
      });

      // 生成完成后自动保存到当前用户账号
      const saveRes = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, painPoint, demand, idea, content: full }),
      });
      const data = await saveRes.json();
      if (saveRes.ok) {
        setPlanId(data.plan.id);
        toast.success("方案已生成并保存");
      } else {
        toast.error(data.error || "方案保存失败");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  }

  /** 迭代优化方案 */
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
    try {
      const full = await streamChat({
        action: "iterate",
        messages: [{ role: "user", content: `补充需求：${extraInput}` }],
        context: content,
      });

      // 更新已保存的方案内容
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
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      {/* 左右分栏 */}
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
            <div>
              <h2 className="text-xl font-bold">{config.name}</h2>
              <p className="text-sm text-muted-foreground">{config.subtitle}</p>
            </div>
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

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className={`w-full gap-2 bg-gradient-to-r ${config.gradient} text-white`}
            >
              <Wand2 className="h-4 w-4" />
              {generating ? "生成中..." : "创新合成"}
            </Button>
          </div>
        </motion.div>

        {/* 右侧：输出区 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col rounded-2xl border bg-white/70 p-6 backdrop-blur"
        >
          <div className="mb-5 flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient} text-white`}
            >
              <ListChecks className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">操作步骤</h2>
              <p className="text-sm text-muted-foreground">{config.desc}</p>
            </div>
          </div>

          {/* 步骤说明 */}
          <ol className="mb-5 space-y-2 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            {config.steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-semibold text-primary">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>

          {/* 方案输出展示区 */}
          <div className="flex-1 overflow-y-auto rounded-lg border bg-background p-4">
            {content ? (
              <Markdown content={content} />
            ) : (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-muted-foreground">
                <Icon className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">
                  {generating
                    ? "AI 正在生成方案..."
                    : "方案将在这里流式展示"}
                </p>
              </div>
            )}
            {generating && content && (
              <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary" />
            )}
          </div>

          {/* 迭代输入区 */}
          <div className="mt-4 flex gap-2">
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
        </motion.div>
      </div>

      {/* 评论区 */}
      <CommentSection planId={planId} />
    </div>
  );
}
