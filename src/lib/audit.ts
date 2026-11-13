/**
 * AI 调用审计
 * 记录每次模型调用的动作、耗时、Token 用量与安全标记，用于成本核算与问题追溯。
 * 写日志失败不影响主流程（降级为控制台输出）。
 */

import { prisma } from "@/lib/db";

export interface AuditInput {
  userId: string;
  action: string;
  mode?: string | null;
  success?: boolean;
  safetyFlags?: string[];
  retrievalCount?: number;
  toolCalls?: number;
  inputChars?: number;
  latencyMs?: number;
  totalTokens?: number;
  /** 已脱敏的输入摘要 */
  preview?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.aiAuditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        mode: input.mode ?? null,
        success: input.success ?? true,
        safetyFlags: (input.safetyFlags ?? []).join(","),
        retrievalCount: input.retrievalCount ?? 0,
        toolCalls: input.toolCalls ?? 0,
        inputChars: input.inputChars ?? 0,
        latencyMs: input.latencyMs ?? 0,
        totalTokens: input.totalTokens ?? 0,
        preview: input.preview ? input.preview.slice(0, 120) : null,
      },
    });
  } catch (error) {
    console.error("[audit] 写入审计日志失败", error);
  }
}

export async function listAuditLogs(userId: string, limit = 20) {
  return prisma.aiAuditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      action: true,
      mode: true,
      success: true,
      safetyFlags: true,
      retrievalCount: true,
      toolCalls: true,
      latencyMs: true,
      totalTokens: true,
      createdAt: true,
    },
  });
}

export async function getAuditSummary(userId: string) {
  const [total, aggregate] = await Promise.all([
    prisma.aiAuditLog.count({ where: { userId } }),
    prisma.aiAuditLog.aggregate({
      where: { userId },
      _sum: { totalTokens: true, toolCalls: true },
      _avg: { latencyMs: true },
    }),
  ]);

  return {
    total,
    totalTokens: aggregate._sum.totalTokens ?? 0,
    totalToolCalls: aggregate._sum.toolCalls ?? 0,
    avgLatencyMs: Math.round(aggregate._avg.latencyMs ?? 0),
  };
}
