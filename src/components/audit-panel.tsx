"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Cpu, Loader2, ShieldCheck, Wrench } from "lucide-react";

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
  createdAt: string;
}

interface AuditSummary {
  total: number;
  totalTokens: number;
  totalToolCalls: number;
  avgLatencyMs: number;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** AI 调用审计面板：Token、耗时、工具调用与安全标记全链路可追溯 */
export function AuditPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/audit?limit=20");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "审计日志加载失败");
      setLogs(data.logs ?? []);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "审计日志加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在加载调用审计...
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {error && <p className="text-xs text-destructive">{error}</p>}

      {logs.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          暂无调用记录，生成方案后即可查看审计数据
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 font-medium">动作</th>
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
                  <td className="px-3 py-2">{log.mode === "business" ? "创业" : log.mode === "tool" ? "工具" : "-"}</td>
                  <td className="px-3 py-2">
                    {log.retrievalCount} / {log.toolCalls}
                  </td>
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
        审计记录包含脱敏后的输入摘要，不存储完整敏感内容；Token 与耗时可用于成本核算与容量规划。
      </p>
    </div>
  );
}
