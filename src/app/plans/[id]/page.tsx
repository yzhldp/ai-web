import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wrench, Briefcase } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Markdown } from "@/components/markdown";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * 方案详情页 /plans/[id]（需登录鉴权）
 * 展示完整方案内容与评论
 */
export default async function PlanDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const plan = await prisma.projectPlan.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { username: true, nickname: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { username: true, nickname: true } },
        },
      },
    },
  });

  if (!plan) {
    notFound();
  }

  const isTool = plan.mode === "tool";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-24">
        <Link
          href="/profile"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回个人主页
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              isTool
                ? "bg-gradient-to-br from-violet-500 to-purple-500"
                : "bg-gradient-to-br from-fuchsia-500 to-pink-500"
            } text-white`}
          >
            {isTool ? (
              <Wrench className="h-6 w-6" />
            ) : (
              <Briefcase className="h-6 w-6" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {isTool ? "工具创新方案" : "创业创新方案"}
            </h1>
            <p className="text-sm text-muted-foreground">
              作者：{plan.user.nickname || plan.user.username} · 更新于{" "}
              {new Date(plan.updatedAt).toLocaleString("zh-CN")}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <Markdown content={plan.content} />
        </div>

        {/* 评论 */}
        <div className="mt-8 rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-lg font-bold">评论（{plan.comments.length}）</h2>
          {plan.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无评论</p>
          ) : (
            <div className="space-y-4">
              {plan.comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {(comment.user.nickname || comment.user.username)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">
                        {comment.user.nickname || comment.user.username}
                      </span>
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
