import Link from "next/link";
import { Wrench, Briefcase, MessageSquare, Users } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { FloatingAssistant } from "@/components/floating-assistant";
import { HomeHero } from "@/components/home-hero";
import { prisma } from "@/lib/db";

// 社区精选依赖数据库实时数据，禁用静态预渲染
export const dynamic = "force-dynamic";

/** 截取方案内容预览 */
function preview(content: string, len = 110) {
  const clean = content
    .replace(/[#>*`\-\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > len ? clean.slice(0, len) + "..." : clean;
}

/**
 * 首页 /home（需登录鉴权，由中间件保护）
 * 包含产品介绍与社区公开项目精选
 */
export default async function HomePage() {
  // 社区精选：最新公开方案，便于发现他人项目并进入评论区交流
  const publicPlans = await prisma.projectPlan.findMany({
    where: { visibility: "public" },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: {
      id: true,
      mode: true,
      content: true,
      updatedAt: true,
      user: { select: { id: true, username: true, nickname: true } },
      _count: { select: { comments: true } },
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        <HomeHero />

        {/* 社区精选：公开项目 */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold">社区精选项目</h2>
              <span className="text-sm text-muted-foreground">
                看看大家在做什么，进入评论区交流
              </span>
            </div>
          </div>

          {publicPlans.length === 0 ? (
            <div className="rounded-2xl border bg-white/70 p-10 text-center text-sm text-muted-foreground backdrop-blur">
              暂无公开项目，去个人主页把项目设为公开，让更多人看到你的创意吧
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {publicPlans.map((plan) => {
                const author = plan.user.nickname || plan.user.username;
                return (
                  <div
                    key={plan.id}
                    className="flex flex-col rounded-2xl border bg-white/70 p-5 backdrop-blur transition-all hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
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

                    <Link
                      href={`/plans/${plan.id}`}
                      className="mb-4 flex-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {preview(plan.content)}
                    </Link>

                    <div className="flex items-center justify-between border-t pt-3">
                      <Link
                        href={`/users/${plan.user.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {author}
                      </Link>
                      <Link
                        href={`/plans/${plan.id}`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        查看项目 →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <FloatingAssistant />
    </div>
  );
}
