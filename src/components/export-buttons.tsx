"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

function safeFileName(title: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `${title.replace(/[\\/:*?"<>|\s]+/g, "-")}-${date}.md`;
}

/** 方案导出：Markdown 下载 + 浏览器打印为 PDF */
export function ExportButtons({ content, title }: { content: string; title: string }) {
  function handleDownload() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeFileName(title);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button size="sm" variant="outline" className="gap-1" onClick={handleDownload}>
        <Download className="h-3.5 w-3.5" />
        导出 Markdown
      </Button>
      <Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" />
        打印 / PDF
      </Button>
    </div>
  );
}
