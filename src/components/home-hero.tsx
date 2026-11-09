"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wrench,
  Briefcase,
  RefreshCw,
  MessageSquare,
  ArrowRight,
  Sparkles,
} from "lucide-react";

/** 功能亮点卡片数据 */
const FEATURES = [
  {
    icon: Wrench,
    title: "工具创新",
    desc: "输入零散痛点，AI 生成软件开发规划：模块划分、技术选型、开发排期一应俱全。",
    color: "from-violet-500 to-purple-500",
    href: "/tool",
  },
  {
    icon: Briefcase,
    title: "创业创新",
    desc: "从创意到商业模式，AI 帮你梳理项目定位、目标人群与落地计划。",
    color: "from-fuchsia-500 to-pink-500",
    href: "/business",
  },
  {
    icon: RefreshCw,
    title: "方案迭代",
    desc: "对已有方案追加需求，AI 持续优化补全，让创意不断进化。",
    color: "from-sky-500 to-blue-500",
    href: "/tool",
  },
  {
    icon: MessageSquare,
    title: "评论交流",
    desc: "与伙伴分享方案、交流想法，在碰撞中激发更多灵感。",
    color: "from-amber-500 to-orange-500",
    href: "/tool",
  },
];

/**
 * 首页介绍区
 * 渐变背景 + 大标题 + 核心价值介绍 + 功能亮点卡片，配合 Framer Motion 入场动效
 */
export function HomeHero() {
  return (
    <div className="relative overflow-hidden">
      {/* 渐变背景装饰 */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-violet-100 via-background to-fuchsia-100" />
      <div className="pointer-events-none absolute -left-24 -top-24 -z-10 h-96 w-96 rounded-full bg-violet-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 -z-10 h-96 w-96 rounded-full bg-fuchsia-300/40 blur-3xl" />

      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        {/* 主标题区 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-white/60 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur">
            <Sparkles className="h-4 w-4" />
            让每一个灵感都有机会变成现实
          </div>
          <h1 className="text-4xl font-black leading-tight tracking-tight md:text-6xl">
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 bg-clip-text text-transparent">
              零散灵感，一键成雏形
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            你只需要输入痛点、需求与奇思妙想，AI
            整合收拢、补全逻辑，生成完整的项目雏形规划，让创意快速落地。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/tool"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-105"
            >
              <Wrench className="h-5 w-5" />
              开始工具创新
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/business"
              className="inline-flex items-center gap-2 rounded-lg border bg-white/70 px-6 py-3 font-semibold text-foreground backdrop-blur transition-colors hover:bg-white"
            >
              <Briefcase className="h-5 w-5" />
              开始创业创新
            </Link>
          </div>
        </motion.div>

        {/* 功能亮点卡片 */}
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
            >
              <Link
                href={feature.href}
                className="group block h-full rounded-2xl border bg-white/70 p-6 backdrop-blur transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} text-white`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* 三步流程说明 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-20 text-center"
        >
          <h2 className="mb-8 text-2xl font-bold">三步生成你的项目雏形</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: "01", title: "输入碎片", desc: "填写痛点、需求、奇思妙想" },
              { step: "02", title: "AI 合成", desc: "智能整合补全，生成结构化规划" },
              { step: "03", title: "迭代落地", desc: "追加需求优化，保存管理方案" },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border bg-white/70 p-6 backdrop-blur"
              >
                <div className="mb-3 text-3xl font-black text-primary/30">
                  {item.step}
                </div>
                <h3 className="mb-1 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
