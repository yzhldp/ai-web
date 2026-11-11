"use client";

import { motion } from "framer-motion";
import { Lightbulb, Wrench, Rocket } from "lucide-react";

/**
 * 漫画小人动态动画（登录页左侧）
 *
 * 布局：整体为左右分半的大背景（左「工具创新」蓝、右「创业创新」紫），
 * 占满整个组件；漫画小人站在中间分割线上；头顶依次冒出三个云朵状气泡
 * 「需求」「痛点」「奇思妙想」，随后向中间聚合，合并成一个「项目雏形」
 * 云朵大气泡，同时小人头顶点亮灯泡并产生发光动效。7 秒循环。
 */
const LOOP = 7; // 单轮动画总时长（秒）

// 云朵气泡：颜色 + 起始位置 + 聚合位移 + 依次出现的时间相位
const BUBBLES = [
  {
    label: "需求",
    fill: "#bfdbfe",
    text: "#1e40af",
    start: "left-0 top-0",
    moveX: 146,
    moveY: 30,
    appearStart: 0.02,
    appearEnd: 0.12,
  },
  {
    label: "痛点",
    fill: "#fbcfe8",
    text: "#9d174d",
    start: "left-[146px] -top-4",
    moveX: 0,
    moveY: 46,
    appearStart: 0.18,
    appearEnd: 0.28,
  },
  {
    label: "奇思妙想",
    fill: "#fde68a",
    text: "#92400e",
    start: "left-[292px] top-0",
    moveX: -146,
    moveY: 30,
    appearStart: 0.34,
    appearEnd: 0.44,
  },
];

/** 云朵形状气泡（三个碎片用） */
function CloudBubble({
  label,
  fill,
  text,
}: {
  label: string;
  fill: string;
  text: string;
}) {
  return (
    <div className="relative">
      <svg width="108" height="64" viewBox="0 0 108 64" fill="none">
        <ellipse cx="36" cy="26" rx="22" ry="17" fill={fill} />
        <ellipse cx="66" cy="22" rx="26" ry="19" fill={fill} />
        <rect x="16" y="34" width="76" height="24" rx="12" fill={fill} />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center pb-2 text-sm font-bold"
        style={{ color: text }}
      >
        {label}
      </span>
    </div>
  );
}

/** 合并后的「项目雏形」云朵大气泡 */
function IdeaCloud() {
  return (
    <div className="relative">
      <svg width="130" height="78" viewBox="0 0 130 78" fill="none">
        <defs>
          <linearGradient id="idea-cloud" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
        <ellipse cx="43" cy="32" rx="27" ry="21" fill="url(#idea-cloud)" />
        <ellipse cx="80" cy="27" rx="31" ry="24" fill="url(#idea-cloud)" />
        <rect x="20" y="40" width="90" height="30" rx="15" fill="url(#idea-cloud)" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center pb-2 text-base font-bold text-white">
        项目雏形
      </span>
    </div>
  );
}

export function ComicCharacter() {
  return (
    <div className="relative flex h-[420px] w-[400px] flex-col items-center justify-end overflow-hidden rounded-3xl shadow-xl">
      {/* 左右分半大背景：工具创新 | 创业创新，使用真实场景图片占满 */}
      <div className="absolute inset-0">
        {/* 左半：工具创新场景图 */}
        <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/images/tool-innovation.jpg')" }}
          />
          {/* 压暗遮罩，保证气泡与文字清晰可读 */}
          <div className="absolute inset-0 bg-slate-900/45" />
          <div className="relative flex h-full flex-col items-center justify-center gap-2">
            <Wrench className="h-14 w-14 text-white/85" strokeWidth={1.5} />
            <span className="text-base font-bold tracking-wider text-white drop-shadow">
              工具创新
            </span>
          </div>
        </div>
        {/* 右半：创业创新场景图 */}
        <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/images/business-innovation.jpg')" }}
          />
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative flex h-full flex-col items-center justify-center gap-2">
            <Rocket className="h-14 w-14 text-white/85" strokeWidth={1.5} />
            <span className="text-base font-bold tracking-wider text-white drop-shadow">
              创业创新
            </span>
          </div>
        </div>
        {/* 中间分割线 */}
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/60" />
      </div>

      {/* 气泡聚合区域（位于分半背景图内、小人头顶上方） */}
      <div className="relative z-10 h-[190px] w-full">
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
            <CloudBubble label={bubble.label} fill={bubble.fill} text={bubble.text} />
          </motion.div>
        ))}

        {/* 合并后的「项目雏形」云朵大气泡 */}
        <motion.div
          className="absolute left-[146px] top-[40px]"
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
          <IdeaCloud />
        </motion.div>

        {/* 灯泡图标 + 发光动效 */}
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
