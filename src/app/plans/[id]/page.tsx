import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wrench, Briefcase, Globe, Lock } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Markdown } from "@/components/markdown";
import { PlanDiagram } from "@/components/plan-diagram";
import { QualityReportView } from "@/components/quality-report";
import { SourceList } from "@/components/source-list";
import { ExportButtons } from "@/components/export-buttons";
import type { QualityReport, SourceRef } from "@/lib/agent/types";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessPlan, isPlanOwner } from "@/lib/plan-access";

/** 安全解析数据库中的 JSON 字符串 */
function parseJSON<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * 方案详情页 /plans/[id]（需登录鉴权）
 * 作者可查看自己全部方案；公开方案其他登录用户也可浏览与评论
 */
export default async function PlanDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const viewer = await getCurrentUser();
  if (!viewer) {
    notFound();
  }

  const plan = await prisma.projectPlan.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, username: true, nickname: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, username: true, nickname: true } },
        },
      },
    },
  });

  if (!plan) {
    notFound();
  }
  // 私有方案仅作者可查看；公开方案允许其他登录用户浏览
  if (!canAccessPlan(plan, viewer.id)) {
    notFound();
  }

  const isOwner = isPlanOwner(plan, viewer.id);
  const authorName = plan.user.nickname || plan.user.username;
  const isPublic = plan.visibility === "public";
  const isTool = plan.mode === "tool";
  const quality = parseJSON<QualityReport>(plan.quality);
  const sources = parseJSON<SourceRef[]>(plan.sources) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-24">
        <Link
          href={isOwner ? "/profile" : `/users/${plan.user.id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {isOwner ? "返回个人主页" : `返回 ${authorName} 的主页`}
        </Link>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                isTool
                  ? "bg-gradient-to-br from-blue-600 to-cyan-500"
                  : "bg-gradient-to-br from-sky-500 to-blue-600"
              } text-white`}
            >
              {isTool ? (
                <Wrench className="h-6 w-6" />
              ) : (
                <Briefcase className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">
                  {isTool ? "工具创新方案" : "创业创新方案"}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    isPublic
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isPublic ? (
                    <Globe className="h-3 w-3" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                  {isPublic ? "公开" : "私有"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                作者：
                <Link
                  href={`/users/${plan.user.id}`}
                  className="hover:text-foreground hover:underline"
                >
                  {authorName}
                </Link>
                {" · "}更新于{" "}
                {new Date(plan.updatedAt).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>
          <ExportButtons
            content={plan.content}
            title={isTool ? "工具创新方案" : "创业创新方案"}
          />
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <Markdown content={plan.content} />
        </div>

        {/* AI 技术补齐产物：架构图 / 质检报告 / 检索依据 */}
        {plan.diagram && (
          <div className="mt-6 rounded-2xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">方案架构图</h2>
            <PlanDiagram chart={plan.diagram} />
          </div>
        )}

        {quality && (
          <div className="mt-6 rounded-2xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">AI 质检报告</h2>
            <QualityReportView quality={quality} />
          </div>
        )}

        {sources.length > 0 && (
          <div className="mt-6 rounded-2xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">知识库检索依据</h2>
            <SourceList sources={sources} />
          </div>
        )}

        {/* 评论 */}
        <div className="mt-8 rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-bold">评论（{plan.comments.length}）</h2>
          {plan.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无评论</p>
          ) : (
            <div className="space-y-4">
              {plan.comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Link
                    href={`/users/${comment.user.id}`}
                    aria-label={`查看 ${
                      comment.user.nickname || comment.user.username
                    } 的个人主页`}
                    title="查看个人主页"
                    className="shrink-0 rounded-full transition-opacity hover:opacity-80"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {(comment.user.nickname || comment.user.username)
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  </Link>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/users/${comment.user.id}`}
                        className="text-sm font-semibold hover:text-primary hover:underline"
                      >
                        {comment.user.nickname || comment.user.username}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
