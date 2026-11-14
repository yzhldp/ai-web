import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Wrench,
  Briefcase,
  Globe,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** 截取方案内容预览 */
function preview(content: string, len = 90) {
  const clean = content
    .replace(/[#>*`\-\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > len ? clean.slice(0, len) + "..." : clean;
}

function formatTime(date: Date) {
  return new Date(date).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 公开用户主页 /users/[id]
 * 展示用户基本信息与其公开项目，供评论区头像跳转访问
 */
export default async function UserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const viewer = await getCurrentUser();
  if (!viewer) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      username: true,
      nickname: true,
      createdAt: true,
    },
  });

  if (!user) {
    notFound();
  }

  const plans = await prisma.projectPlan.findMany({
    where: { userId: user.id, visibility: "public" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      mode: true,
      content: true,
      updatedAt: true,
      _count: { select: { comments: true } },
    },
  });

  const isOwner = viewer.id === user.id;
  const displayName = user.nickname || user.username;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24">
        <Link
          href={isOwner ? "/profile" : "/home"}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {isOwner ? "返回个人主页" : "返回首页"}
        </Link>

        {/* 用户信息 */}
        <div className="mb-8 flex flex-col items-center rounded-2xl border bg-white/70 p-8 text-center backdrop-blur">
          <Avatar className="h-20 w-20 text-3xl">
            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-500 text-3xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h1 className="mt-3 text-xl font-bold">{displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            账号：{user.username} · 加入于{" "}
            {new Date(user.createdAt).toLocaleDateString("zh-CN")}
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4 text-emerald-600" />
            公开项目 {plans.length} 个
          </div>
          {isOwner && (
            <Link
              href="/profile"
              className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Settings className="h-4 w-4" />
              管理我的项目与公开状态
            </Link>
          )}
        </div>

        {/* 公开项目库 */}
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-bold">公开项目</h2>
          <span className="text-sm text-muted-foreground">
            （仅展示该用户设为公开的项目）
          </span>
        </div>

        {plans.length === 0 ? (
          <div className="rounded-2xl border bg-white/70 p-10 text-center text-sm text-muted-foreground backdrop-blur">
            该用户暂未公开任何项目
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/plans/${plan.id}`}
                className="flex flex-col rounded-xl border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                      plan.mode === "tool"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {plan.mode === "tool" ? (
                      <Wrench className="h-3 w-3" />
                    ) : (
                      <Briefcase className="h-3 w-3" />
                    )}
                    {plan.mode === "tool" ? "工具创新" : "创业创新"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    {plan._count.comments}
                  </span>
                </div>
                <p className="mb-4 flex-1 text-sm text-muted-foreground">
                  {preview(plan.content)}
                </p>
                <p className="text-xs text-muted-foreground">
                  更新于 {formatTime(plan.updatedAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
