"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Mermaid 架构图渲染
 * 动态加载 mermaid（按需分包），避免主包体积膨胀；渲染结果支持导出 SVG。
 */
export function PlanDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const counter = useRef(0);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    if (!chart) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
          themeVariables: {
            primaryColor: "#dbeafe",
            primaryBorderColor: "#3b82f6",
            primaryTextColor: "#1f2937",
            lineColor: "#60a5fa",
            secondaryColor: "#e0f2fe",
            tertiaryColor: "#eff6ff",
          },
        });
        counter.current += 1;
        const { svg } = await mermaid.render(`plan-diagram-${counter.current}`, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setStatus("done");
        }
      } catch (error) {
        console.warn("[diagram] mermaid 渲染失败", error);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  function handleDownload() {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plan-architecture.svg";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!chart) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        <ImageOff className="mb-2 h-8 w-8 opacity-40" />
        生成方案后自动输出架构图
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          AI 依据方案核心模块生成的 Mermaid 架构图，可导出为 SVG
        </p>
        <Button size="sm" variant="outline" className="gap-1" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
          导出 SVG
        </Button>
      </div>

      {status === "loading" && (
        <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在渲染架构图...
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg border border-dashed p-4">
          <p className="mb-2 text-sm text-muted-foreground">架构图渲染失败，已展示源码：</p>
          <pre className="overflow-auto whitespace-pre-wrap rounded bg-muted/60 p-3 text-xs">
            {chart}
          </pre>
        </div>
      )}

      <div
        ref={containerRef}
        className={`flex min-h-[200px] items-center justify-center overflow-auto rounded-lg border bg-white p-4 [&_svg]:max-w-full ${
          status === "done" ? "" : "hidden"
        }`}
      />
    </div>
  );
}
