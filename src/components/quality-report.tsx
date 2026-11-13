"use client";

import { memo } from "react";
import { Lightbulb, Timer, Cpu, AlertTriangle } from "lucide-react";
import type { AgentUsage, QualityReport } from "@/lib/agent/types";

function scoreColor(score: number) {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-sky-500";
  if (score >= 55) return "bg-amber-500";
  return "bg-destructive";
}

/**
 * 方案质检报告
 * 五维评分 + 改进建议 + 本次调用的 Token / 耗时，体现 AI 结果可控与成本可观测。
 */
export const QualityReportView = memo(function QualityReportView({
  quality,
  usage,
  latencyMs,
  warnings,
}: {
  quality: QualityReport | null;
  usage?: AgentUsage | null;
  latencyMs?: number;
  warnings?: string[];
}) {
  if (!quality) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        生成完成后将自动进行方案质检
      </p>
    );
  }

  const total = Math.round(
    quality.dimensions.reduce((sum, item) => sum + item.score, 0) / quality.dimensions.length
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 border-primary/20">
          <span className="text-2xl font-bold text-primary">{total}</span>
          <span className="text-[10px] text-muted-foreground">综合得分</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
          {usage && (
            <p className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" />
              本次消耗 {usage.totalTokens.toLocaleString()} tokens（输入 {usage.promptTokens} / 输出{" "}
              {usage.completionTokens}）
            </p>
          )}
          {latencyMs ? (
            <p className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" />
              端到端耗时 {(latencyMs / 1000).toFixed(1)} 秒
            </p>
          ) : null}
          <p>评分为模型自评，用于发现方案短板，不代表权威结论。</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {quality.dimensions.map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground">{item.score} 分</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${scoreColor(item.score)}`}
                style={{ width: `${Math.max(4, Math.min(100, item.score))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.comment}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-background p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          改进建议
        </p>
        <ul className="space-y-1 text-xs leading-relaxed text-foreground/80">
          {quality.suggestions.map((item, index) => (
            <li key={index} className="flex gap-1.5">
              <span className="text-primary">{index + 1}.</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {warnings && warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            降级提示
          </p>
          <ul className="space-y-1 text-[11px] text-amber-800">
            {warnings.map((item, index) => (
              <li key={index}>· {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
