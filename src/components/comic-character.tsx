"use client";

import { motion } from "framer-motion";
import { Lightbulb, Wrench, Rocket } from "lucide-react";

/**
 * 漫画小人动态动画（登录页左侧）
 *
 * 动画循环流程（单轮 LOOP 秒，无限循环）：
 * 1. 小人头顶依次冒出三个气泡：「需求」「痛点」「奇思妙想」
 * 2. 三个气泡向中间聚合、合并成一个「项目雏形」大气泡（位于小人正头顶上方）
 * 3. 小人头顶同步点亮灯泡图标并产生发光动效
 * 4. 一轮结束后重置，循环播放
 *
 * 背景为左右分半的舞台画面：左侧「工具创新」、右侧「创业创新」，
 * 漫画小人站在画面中间分割线上。
 *
 * 采用 Framer Motion keyframes 数组 + times 实现单一循环，
 * 全程声明式、无副作用，避免内存泄漏。
 */
const LOOP = 7; // 单轮动画总时长（秒）

// 三个碎片气泡的起始位置、颜色、聚合位移，以及各自的「依次出现」时间相位
const BUBBLES = [
  {
    label: "需求",
    color: "bg-sky-100 text-sky-600 border-sky-300",
    start: "left-0 top-0",
    moveX: 88,
    moveY: 42,
    appearStart: 0.02,
    appearEnd: 0.12,
  },
  {
    label: "痛点",
    color: "bg-rose-100 text-rose-600 border-rose-300",
    start: "left-[110px] -top-3",
    moveX: 0,
    moveY: 56,
    appearStart: 0.18,
    appearEnd: 0.28,
  },
  {
    label: "奇思妙想",
    color: "bg-amber-100 text-amber-600 border-amber-300",
    start: "left-[224px] top-0",
    moveX: -88,
    moveY: 42,
    appearStart: 0.34,
    appearEnd: 0.44,
  },
];

export function ComicCharacter() {
  return (
    <div className="relative flex h-[400px] w-[360px] flex-col items-center justify-end">
      {/* 左右分半背景舞台：工具创新 | 创业创新 */}
      <div className="absolute inset-x-0 bottom-0 z-0 h-[230px] overflow-hidden rounded-3xl border-2 border-white/25 bg-white/5 shadow-2xl backdrop-blur-sm">
        {/* 左半：工具创新标志画面 */}
        <div className="absolute inset-y-0 left-0 flex w-1/2 flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-500/25 to-indigo-600/10">
          <Wrench className="h-14 w-14 text-blue-200/70" strokeWidth={1.5} />
          <span className="text-sm font-bold tracking-wider text-blue-100/90">
            工具创新
          </span>
        </div>
        {/* 右半：创业创新标志画面 */}
        <div className="absolute inset-y-0 right-0 flex w-1/2 flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-500/25 to-rose-500/10">
          <Rocket className="h-14 w-14 text-amber-200/70" strokeWidth={1.5} />
          <span className="text-sm font-bold tracking-wider text-amber-100/90">
            创业创新
          </span>
        </div>
        {/* 中间分割线 */}
        <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-white/50" />
      </div>

      {/* 气泡聚合区域 */}
      <div className="relative z-10 h-[190px] w-full">
        {/* 三个碎片气泡：依次出现，随后一起聚合 */}
        {BUBBLES.map((bubble) => (
          <motion.div
            key={bubble.label}
            className={`absolute ${bubble.start}`}
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 0, 1, 1, 1, 0, 0],
              scale: [0, 0.4, 1, 1, 1, 0.4, 0],
              x: [0, 0, 0, 0, bubble.moveX, bubble.moveX, bubble.moveX],
              y: [0, 0, 0, 0, bubble.moveY, bubble.moveY, bubble.moveY],
            }}
            transition={{
              duration: LOOP,
              times: [
                0,
                bubble.appearStart,
                bubble.appearEnd,
                0.45,
                0.55,
                0.58,
                1,
              ],
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div
              className={`flex h-10 items-center justify-center rounded-2xl border-2 px-3 text-sm font-semibold shadow-md ${bubble.color}`}
            >
              {bubble.label}
            </div>
          </motion.div>
        ))}

        {/* 合并后的「项目雏形」大气泡（位于小人正头顶上方） */}
        <motion.div
          className="absolute left-[72px] top-[52px]"
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0, 1, 1, 0, 0],
            scale: [0, 0, 1, 1, 0.8, 0],
          }}
          transition={{
            duration: LOOP,
            times: [0, 0.55, 0.62, 0.82, 0.88, 1],
            repeat: Infinity,
            ease: "easeOut",
          }}
        >
          <div className="flex h-16 items-center justify-center rounded-3xl border-2 border-violet-300 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 text-lg font-bold text-white shadow-xl shadow-violet-300/50">
            项目雏形
          </div>
        </motion.div>

        {/* 灯泡图标 + 发光动效（与项目雏形同步点亮） */}
        <motion.div
          className="absolute left-1/2 top-[128px] -translate-x-1/2"
          initial={{ opacity: 0, scale: 0.5, filter: "drop-shadow(0 0 0px rgba(250,204,21,0))" }}
          animate={{
            opacity: [0, 0, 1, 1, 0, 0],
            scale: [0.5, 0.5, 1, 1, 0.5, 0.5],
            filter: [
              "drop-shadow(0 0 0px rgba(250,204,21,0))",
              "drop-shadow(0 0 0px rgba(250,204,21,0))",
              "drop-shadow(0 0 12px rgba(250,204,21,0.9))",
              "drop-shadow(0 0 20px rgba(250,204,21,1))",
              "drop-shadow(0 0 0px rgba(250,204,21,0))",
              "drop-shadow(0 0 0px rgba(250,204,21,0))",
            ],
          }}
          transition={{
            duration: LOOP,
            times: [0, 0.55, 0.62, 0.82, 0.88, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Lightbulb className="h-9 w-9 text-yellow-400" fill="currentColor" />
        </motion.div>
      </div>

      {/* 漫画小人（SVG），站在背景分割线中间 */}
      <svg
        width="160"
        height="150"
        viewBox="0 0 160 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 mt-1"
      >
        {/* 头 */}
        <circle cx="80" cy="38" r="30" fill="#FDE2B1" stroke="#3B3B3B" strokeWidth="3" />
        {/* 头发 */}
        <path
          d="M50 34 C50 12 110 12 110 34 C110 30 100 24 80 24 C60 24 50 30 50 34 Z"
          fill="#3B3B3B"
        />
        {/* 眼睛 */}
        <circle cx="70" cy="40" r="3.5" fill="#3B3B3B" />
        <circle cx="90" cy="40" r="3.5" fill="#3B3B3B" />
        {/* 腮红 */}
        <circle cx="63" cy="48" r="4" fill="#FFB3C1" opacity="0.7" />
        <circle cx="97" cy="48" r="4" fill="#FFB3C1" opacity="0.7" />
        {/* 微笑 */}
        <path d="M72 52 Q80 60 88 52" stroke="#3B3B3B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* 身体 */}
        <rect x="55" y="72" width="50" height="46" rx="14" fill="#7C5CFF" stroke="#3B3B3B" strokeWidth="3" />
        {/* 手臂 */}
        <path d="M55 84 L38 100" stroke="#3B3B3B" strokeWidth="6" strokeLinecap="round" />
        <path d="M105 84 L122 100" stroke="#3B3B3B" strokeWidth="6" strokeLinecap="round" />
        {/* 腿 */}
        <path d="M68 118 L64 140" stroke="#3B3B3B" strokeWidth="7" strokeLinecap="round" />
        <path d="M92 118 L96 140" stroke="#3B3B3B" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
}
