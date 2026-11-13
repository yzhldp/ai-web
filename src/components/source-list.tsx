"use client";

import { memo, useState } from "react";
import { BookOpen, ChevronDown, Hash } from "lucide-react";
import type { PlanAnalysis, SourceRef, ToolTrace } from "@/lib/agent/types";

/**
 * RAG 检索依据面板
 * 展示每条召回的来源、双通道得分与命中关键词，体现检索过程可解释。
 */
export const SourceList = memo(function SourceList({ sources }: { sources: SourceRef[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!sources.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        本轮未检索到高相关度知识库内容，方案基于通用经验生成。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>混合检索：BM25 0.4 + 稀疏向量余弦 0.6</span>
        <span>共 {sources.length} 条</span>
      </div>
      {sources.map((source, index) => {
        const open = expanded === source.id;
        return (
          <div key={source.id} className="rounded-lg border bg-background p-3">
            <button
              type="button"
              onClick={() => setExpanded(open ? null : source.id)}
              className="flex w-full items-start gap-2 text-left"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[11px] font-semibold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{source.docTitle}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {source.category}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">· {source.heading}</p>
                <p
                  className={`mt-1 text-xs leading-relaxed text-foreground/80 ${
                    open ? "" : "line-clamp-2"
                  }`}
                >
                  {source.content}
                </p>
              </div>
              <ChevronDown
                className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2 text-[10px] text-muted-foreground">
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                融合 {source.score}
              </span>
              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
                向量 {source.cosine}
              </span>
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                BM25 {source.bm25}
              </span>
              {source.matched?.slice(0, 4).map((token) => (
                <span key={token} className="inline-flex items-center gap-0.5">
                  <Hash className="h-2.5 w-2.5" />
                  {token}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});

/** 需求解析结果 */
export const AnalysisPanel = memo(function AnalysisPanel({
  analysis,
}: {
  analysis: PlanAnalysis | null;
}) {
  if (!analysis) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        暂无解析结果
      </p>
    );
  }

  const groups = [
    { title: "一句话概括", items: [analysis.summary] },
    { title: "所属领域", items: [analysis.domain] },
    { title: "目标用户", items: analysis.targetUsers },
    { title: "核心痛点", items: analysis.painPoints },
    { title: "核心功能", items: analysis.keyFeatures },
    { title: "约束条件", items: analysis.constraints },
    { title: "检索关键词", items: analysis.keywords },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.title} className="rounded-lg border bg-background p-3">
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{group.title}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="rounded-md bg-muted px-2 py-1 text-xs leading-relaxed"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

/** 工具调用轨迹 */
export const ToolTraceList = memo(function ToolTraceList({ tools }: { tools: ToolTrace[] }) {
  if (!tools.length) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        快速模式未调用工具
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {tools.map((tool, index) => (
        <div key={`${tool.name}-${index}`} className="rounded-lg border bg-background p-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs font-semibold">{tool.name}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {tool.durationMs ? `${tool.durationMs}ms` : "规则引擎"}
            </span>
          </div>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/60 p-2 text-[11px] leading-relaxed">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
            {tool.summary}
          </p>
        </div>
      ))}
    </div>
  );
});
