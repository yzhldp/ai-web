"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Check,
  Cpu,
  Loader2,
  Play,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuditLog {
  id: string;
  action: string;
  mode: string | null;
  success: boolean;
  safetyFlags: string;
  retrievalCount: number;
  toolCalls: number;
  latencyMs: number;
  totalTokens: number;
  provider: string | null;
  model: string | null;
  fallbacks: number;
  createdAt: string;
}

interface AuditSummary {
  total: number;
  totalTokens: number;
  totalToolCalls: number;
  avgLatencyMs: number;
}

interface ProviderStatus {
  id: string;
  label: string;
  model: string;
  baseHost: string;
  configured: boolean;
  active: boolean;
  primary: boolean;
}

interface ModelStatus {
  fallbackEnabled: boolean;
  primaryProvider: string | null;
  configuredCount: number;
  providers: ProviderStatus[];
}

interface EvalTest {
  ok: boolean;
  latencyMs: number;
  tokens: number;
  error?: string;
}

interface EvalResult {
  id: string;
  label: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  tokens: number;
  structured: EvalTest;
  tool: EvalTest;
  citation: EvalTest;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TestBadge({ test }: { test: EvalTest }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] ${
        test.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
      title={test.error}
    >
      {test.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      {test.latencyMs}ms
    </span>
  );
}

/** AI 调用审计 + 模型路由与质量评测 */
export function AuditPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [evalLoading, setEvalLoading] = useState(false);
  const [evalResults, setEvalResults] = useState<EvalResult[] | null>(null);
  const [evalError, setEvalError] = useState("");

  const loadAudit = useCallback(async () => {
    const res = await fetch("/api/agent/audit?limit=20");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "审计日志加载失败");
    setLogs(data.logs ?? []);
    setSummary(data.summary);
  }, []);

  const loadModels = useCallback(async () => {
    const res = await fetch("/api/agent/models");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "模型状态加载失败");
    setModelStatus(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadAudit(), loadModels()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAudit, loadModels]);

  async function runEvaluation() {
    setEvalLoading(true);
    setEvalError("");
    try {
      const res = await fetch("/api/agent/models/evaluate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "模型评测失败");
      setEvalResults(data.results ?? []);
      await loadAudit();
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "模型评测失败");
    } finally {
      setEvalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在加载调用审计与模型状态...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 用量统计 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Activity, label: "调用次数", value: summary?.total ?? 0 },
          { icon: Cpu, label: "Token 总消耗", value: (summary?.totalTokens ?? 0).toLocaleString() },
          { icon: Wrench, label: "工具调用", value: summary?.totalToolCalls ?? 0 },
          { icon: ShieldCheck, label: "平均耗时", value: `${summary?.avgLatencyMs ?? 0}ms` },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border bg-white p-3">
              <Icon className="mb-1.5 h-4 w-4 text-primary" />
              <p className="text-lg font-bold">{item.value}</p>
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
            </div>
          );
        })}
      </div>

      {/* 模型路由 */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">模型路由</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              自动故障转移：
              <span className={modelStatus?.fallbackEnabled ? "text-emerald-600" : "text-amber-600"}>
                {modelStatus?.fallbackEnabled ? "已开启" : "已关闭"}
              </span>
              {" · "}已配置 {modelStatus?.configuredCount ?? 0} 个供应商
              {modelStatus?.primaryProvider
                ? ` · 主供应商 ${modelStatus.primaryProvider}`
                : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={runEvaluation}
            disabled={evalLoading || (modelStatus?.configuredCount ?? 0) === 0}
          >
            {evalLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {evalLoading ? "评测中..." : "运行模型评测"}
          </Button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {modelStatus?.providers.map((provider) => (
            <div
              key={provider.id}
              className={`rounded-lg border p-2.5 ${
                provider.active ? "border-primary/30 bg-primary/5" : "bg-muted/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{provider.label}</span>
                {provider.primary && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">
                    主
                  </span>
                )}
                <span
                  className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] ${
                    provider.configured
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {provider.configured ? (provider.active ? "已启用" : "已配置·未参与") : "未配置"}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                {provider.model} · {provider.baseHost}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-2 text-[10px] text-muted-foreground">
          评测会分别测试「结构化 JSON / Function Calling / 引用标记」，真实消耗 Token，每小时最多 3 次。
        </p>

        {evalError && <p className="mt-2 text-xs text-destructive">{evalError}</p>}

        {evalResults && (
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">供应商</th>
                  <th className="px-3 py-2 font-medium">结构化</th>
                  <th className="px-3 py-2 font-medium">工具调用</th>
                  <th className="px-3 py-2 font-medium">引用</th>
                  <th className="px-3 py-2 font-medium">总耗时</th>
                  <th className="px-3 py-2 font-medium">Tokens</th>
                  <th className="px-3 py-2 font-medium">结论</th>
                </tr>
              </thead>
              <tbody>
                {evalResults.map((result) => (
                  <tr key={result.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{result.label}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{result.model}</p>
                    </td>
                    <td className="px-3 py-2"><TestBadge test={result.structured} /></td>
                    <td className="px-3 py-2"><TestBadge test={result.tool} /></td>
                    <td className="px-3 py-2"><TestBadge test={result.citation} /></td>
                    <td className="px-3 py-2">{(result.latencyMs / 1000).toFixed(1)}s</td>
                    <td className="px-3 py-2">{result.tokens}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {result.ok ? "可用" : "部分失败"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* 调用明细 */}
      {logs.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          暂无调用记录，生成方案后即可查看审计数据
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 font-medium">动作</th>
                <th className="px-3 py-2 font-medium">模型</th>
                <th className="px-3 py-2 font-medium">类型</th>
                <th className="px-3 py-2 font-medium">检索 / 工具</th>
                <th className="px-3 py-2 font-medium">Tokens</th>
                <th className="px-3 py-2 font-medium">耗时</th>
                <th className="px-3 py-2 font-medium">安全标记</th>
                <th className="px-3 py-2 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="px-3 py-2 text-muted-foreground">{formatTime(log.createdAt)}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{log.action}</td>
                  <td className="px-3 py-2">
                    {log.provider ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                          log.fallbacks > 0
                            ? "bg-amber-50 text-amber-700"
                            : "bg-sky-50 text-sky-700"
                        }`}
                        title={log.model ?? undefined}
                      >
                        {log.provider}
                        {log.fallbacks > 0 ? ` · 切换${log.fallbacks}` : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {log.mode === "business" ? "创业" : log.mode === "tool" ? "工具" : "-"}
                  </td>
                  <td className="px-3 py-2">{log.retrievalCount} / {log.toolCalls}</td>
                  <td className="px-3 py-2">{log.totalTokens}</td>
                  <td className="px-3 py-2">{log.latencyMs ? `${(log.latencyMs / 1000).toFixed(1)}s` : "-"}</td>
                  <td className="max-w-[160px] px-3 py-2">
                    {log.safetyFlags ? (
                      <span className="line-clamp-2 text-amber-700">{log.safetyFlags}</span>
                    ) : (
                      <span className="text-muted-foreground">无</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        log.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {log.success ? "成功" : "失败"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        审计记录包含脱敏后的输入摘要，不存储完整敏感内容；Token、耗时与切换次数可用于成本核算与路由优化。
      </p>
    </div>
  );
}
