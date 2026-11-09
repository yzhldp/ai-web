"use client";

import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

/**
 * 漫画小人动态动画（登录页左侧）
 * 动画循环流程：
 * 1. 小人头顶依次冒出三个气泡：「痛点」「需求」「奇思妙想」
 * 2. 三个气泡向中间移动、聚合合并成一个「项目雏形」大气泡
 * 3. 小人头顶点亮灯泡图标并产生发光动效
 * 4. 一轮结束后重置，循环播放
 *
 * 采用 Framer Motion keyframes 数组 + times 实现单一 6 秒循环，
 * 全程声明式、无副作用，避免内存泄漏。
 */
const LOOP = 6; // 单轮动画总时长（秒）

// 三个碎片气泡的起始位置（绝对定位）与聚合位移
const BUBBLES = [
  {
    label: "痛点",
    start: "left-0 top-0",
    color: "bg-rose-100 text-rose-600 border-rose-300",
    moveX: 88,
    moveY: 42,
  },
  {
    label: "需求",
    start: "left-[110px] -top-3",
    color: "bg-sky-100 text-sky-600 border-sky-300",
    moveX: 0,
    moveY: 56,
  },
  {
    label: "奇思妙想",
    start: "left-[224px] top-0",
    color: "bg-amber-100 text-amber-600 border-amber-300",
    moveX: -88,
    moveY: 42,
  },
];

export function ComicCharacter() {
  return (
    <div className="relative flex h-[340px] w-[320px] flex-col items-center justify-end">
      {/* 气泡聚合区域 */}
      <div className="relative h-[180px] w-full">
        {/* 三个碎片气泡 */}
        {BUBBLES.map((bubble) => (
          <motion.div
            key={bubble.label}
            className={`absolute ${bubble.start}`}
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 1, 1, 0, 0],
              scale: [0, 1, 1, 1, 0.5, 0],
              x: [0, 0, bubble.moveX, bubble.moveX, bubble.moveX, 0],
              y: [0, 0, bubble.moveY, bubble.moveY, bubble.moveY, 0],
            }}
            transition={{
              duration: LOOP,
              times: [0, 0.12, 0.42, 0.5, 0.54, 1],
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

        {/* 合并后的「项目雏形」大气泡 */}
        <motion.div
          className="absolute left-[72px] top-[52px]"
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0, 0, 1, 1, 0],
            scale: [0, 0, 0, 1, 1, 0.8],
          }}
          transition={{
            duration: LOOP,
            times: [0, 0.48, 0.52, 0.58, 0.8, 1],
            repeat: Infinity,
            ease: "easeOut",
          }}
        >
          <div className="flex h-16 items-center justify-center rounded-3xl border-2 border-violet-300 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 text-lg font-bold text-white shadow-xl shadow-violet-300/50">
            项目雏形
          </div>
        </motion.div>

        {/* 灯泡图标 + 发光动效 */}
        <motion.div
          className="absolute left-1/2 top-[128px] -translate-x-1/2"
          initial={{ opacity: 0, scale: 0.5, filter: "drop-shadow(0 0 0px rgba(250,204,21,0))" }}
          animate={{
            opacity: [0, 0, 0, 1, 1, 0],
            scale: [0.5, 0.5, 0.5, 1, 1, 0.5],
            filter: [
              "drop-shadow(0 0 0px rgba(250,204,21,0))",
              "drop-shadow(0 0 0px rgba(250,204,21,0))",
              "drop-shadow(0 0 0px rgba(250,204,21,0))",
              "drop-shadow(0 0 12px rgba(250,204,21,0.9))",
              "drop-shadow(0 0 20px rgba(250,204,21,1))",
              "drop-shadow(0 0 0px rgba(250,204,21,0))",
            ],
          }}
          transition={{
            duration: LOOP,
            times: [0, 0.5, 0.54, 0.6, 0.82, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Lightbulb className="h-9 w-9 text-yellow-400" fill="currentColor" />
        </motion.div>
      </div>

      {/* 漫画小人（SVG） */}
      <svg
        width="160"
        height="150"
        viewBox="0 0 160 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mt-1"
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
