"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/** 全局错误边界：避免单个页面异常导致整站白屏 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] 页面渲染异常", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-bold">页面暂时无法加载</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        可能是网络波动或服务暂时不可用，请稍后重试。若问题持续，请联系管理员查看服务日志。
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <RotateCcw className="h-4 w-4" />
        重新加载
      </button>
    </div>
  );
}
