"use client";

import { memo } from "react";
import {
  Brain,
  BookOpen,
  Wrench,
  PenLine,
  ShieldCheck,
  Check,
  Loader2,
  X,
  Minus,
} from "lucide-react";
import type { AgentStage } from "@/lib/agent/types";

export type StageStatus = "pending" | "running" | "done" | "error" | "skip";

export interface StageView {
  stage: AgentStage;
  label: string;
  status: StageStatus;
  detail?: string;
  durationMs?: number;
}

const ICONS: Record<AgentStage, typeof Brain> = {
  analyze: Brain,
  retrieve: BookOpen,
  tools: Wrench,
  generate: PenLine,
  quality: ShieldCheck,
};

function formatDuration(ms?: number) {
  if (!ms || ms < 0) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Agent 工作流时间线
 * 展示五个阶段的实时状态与耗时，让生成过程可观测、可解释。
 */
export const AgentTimeline = memo(function AgentTimeline({ stages }: { stages: StageView[] }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {stages.map((item, index) => {
          const Icon = ICONS[item.stage];
          const running = item.status === "running";
          const done = item.status === "done";
          const failed = item.status === "error";
          const skipped = item.status === "skip";

          return (
            <div key={item.stage} className="flex flex-1 items-start gap-2">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    failed
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : running
                          ? "border-primary bg-primary/10 text-primary"
                          : skipped
                            ? "border-muted-foreground/30 bg-muted text-muted-foreground"
                            : "border-muted-foreground/30 bg-background text-muted-foreground"
                  }`}
                >
                  {failed ? (
                    <X className="h-4 w-4" />
                  ) : done ? (
                    <Check className="h-4 w-4" />
                  ) : running ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : skipped ? (
                    <Minus className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                {index < stages.length - 1 && (
                  <div
                    className={`mt-1 hidden h-px w-full min-w-4 sm:block ${
                      done ? "bg-emerald-500/50" : "bg-border"
                    }`}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-medium ${
                      running ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.durationMs ? (
                    <span className="text-[10px] text-muted-foreground">
                      {formatDuration(item.durationMs)}
                    </span>
                  ) : null}
                </div>
                {item.detail && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {item.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export function createInitialStages(): StageView[] {
  return (["analyze", "retrieve", "tools", "generate", "quality"] as AgentStage[]).map(
    (stage) => ({
      stage,
      label:
        stage === "analyze"
          ? "需求解析"
          : stage === "retrieve"
            ? "知识检索"
            : stage === "tools"
              ? "工具推理"
              : stage === "generate"
                ? "方案生成"
                : "质检与架构图",
      status: "pending" as StageStatus,
    })
  );
};
