"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SourceRef } from "@/lib/agent/types";

interface KnowledgeStats {
  documents: number;
  chunks: number;
  dimensions: number;
  categories: string[];
  docs: { id: string; title: string; category: string; tags: string[]; chunks: number }[];
}

interface RagEvalCase {
  query: string;
  expectedDocIds: string[];
  recall: number;
  hit: boolean;
  reciprocalRank: number;
}

interface RagEvalSummary {
  topK: number;
  caseCount: number;
  avgRecall: number;
  hitRate: number;
  mrr: number;
  cases: RagEvalCase[];
}

const SAMPLE_QUERIES = ["AI 应用如何做 RAG", "小团队开发排期怎么估", "教育产品合规风险"];

/**
 * 知识库面板
 * 展示 RAG 语料规模与分类，并提供混合检索调试，便于评委验证检索效果。
 */
export function KnowledgePanel() {
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SourceRef[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<RagEvalSummary | null>(null);
  const [evalError, setEvalError] = useState("");

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "知识库加载失败");
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function handleSearch(value?: string) {
    const keyword = (value ?? query).trim();
    if (!keyword) return;
    setQuery(keyword);
    setSearching(true);
    setError("");
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: keyword, topK: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "检索失败");
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "检索失败");
    } finally {
      setSearching(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在加载知识库索引...
      </div>
    );
  }

  async function runEvaluation() {
    setEvaluating(true);
    setEvalError("");
    try {
      const res = await fetch("/api/knowledge/evaluate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "评测失败");
      setEvaluation(data);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "评测失败");
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "领域文档", value: stats?.documents ?? 0 },
          { label: "知识切块", value: stats?.chunks ?? 0 },
          { label: "向量维度", value: stats?.dimensions ?? 0 },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border bg-background p-3 text-center">
            <p className="text-lg font-bold text-primary">{item.value}</p>
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-background p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
          <Database className="h-3.5 w-3.5 text-primary" />
          内置知识库（随服务端打包，无需外部向量库）
        </p>
        <div className="flex flex-wrap gap-1.5">
          {stats?.docs.map((doc) => (
            <span
              key={doc.id}
              className="rounded-md bg-muted px-2 py-1 text-[11px]"
              title={doc.tags.join("、")}
            >
              {doc.title} · {doc.chunks}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSearch();
            }}
            placeholder="输入关键词体验混合检索..."
            className="flex-1"
          />
          <Button onClick={() => handleSearch()} disabled={searching || !query.trim()} className="gap-1">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            检索
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            试试：
          </span>
          {SAMPLE_QUERIES.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => handleSearch(sample)}
              className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {results && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            命中 {results.length} 条（融合得分 = 0.6 × 向量余弦 + 0.4 × BM25 归一化）
          </p>
          {results.map((item, index) => (
            <div key={item.id} className="rounded-lg border bg-background p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[11px] font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-xs font-medium">
                  {item.docTitle} · {item.heading}
                </span>
                <span className="ml-auto text-[10px] text-emerald-600">{item.score}</span>
              </div>
              <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {item.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* RAG 量化评测 */}
      <div className="rounded-lg border bg-background p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold">检索质量评测</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              内置 10 条标注查询，计算 Recall@6 / HitRate / MRR
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={runEvaluation}
            disabled={evaluating}
          >
            {evaluating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {evaluating ? "评测中..." : "运行评测"}
          </Button>
        </div>

        {evalError && <p className="mt-2 text-xs text-destructive">{evalError}</p>}

        {evaluation && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: `Recall@${evaluation.topK}`, value: `${(evaluation.avgRecall * 100).toFixed(1)}%` },
                { label: "HitRate", value: `${(evaluation.hitRate * 100).toFixed(1)}%` },
                { label: "MRR", value: evaluation.mrr.toFixed(3) },
              ].map((metric) => (
                <div key={metric.label} className="rounded-md bg-muted/40 p-2 text-center">
                  <p className="text-sm font-bold text-primary">{metric.value}</p>
                  <p className="text-[10px] text-muted-foreground">{metric.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-1">
              {evaluation.cases.map((item) => (
                <div
                  key={item.query}
                  className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1 text-[11px]"
                >
                  <span className="min-w-0 flex-1 truncate" title={item.query}>
                    {item.query}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] ${
                      item.hit
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {item.hit ? "命中" : "未命中"}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    Recall {Math.round(item.recall * 100)}%
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-2 text-[10px] text-muted-foreground">
              指标用于开发期对比检索策略，不代表线上真实查询分布。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
