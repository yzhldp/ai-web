"use client";

import { useId } from "react";

/** 卡通版创意助手头像（纯 SVG，无外部资源） */
export function AssistantAvatar({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bodyId = `assistant-body-${uid}`;
  const faceId = `assistant-face-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="创意助手卡通形象"
    >
      <defs>
        <linearGradient id={bodyId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={faceId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>

      {/* 天线 */}
      <path
        d="M32 13 L32 7"
        stroke="#1e3a8a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="6" r="3.2" fill="#22d3ee" stroke="#1e40af" strokeWidth="1">
        <animate attributeName="opacity" values="1;0.45;1" dur="2.2s" repeatCount="indefinite" />
      </circle>

      {/* 耳机 */}
      <rect x="7" y="25" width="5" height="13" rx="2.5" fill="#38bdf8" stroke="#1e40af" strokeWidth="1.2" />
      <rect x="52" y="25" width="5" height="13" rx="2.5" fill="#38bdf8" stroke="#1e40af" strokeWidth="1.2" />

      {/* 头部 */}
      <rect
        x="12"
        y="14"
        width="40"
        height="38"
        rx="15"
        fill={`url(#${bodyId})`}
        stroke="#1e40af"
        strokeWidth="2"
      />

      {/* 面部屏幕 */}
      <rect
        x="18"
        y="22"
        width="28"
        height="21"
        rx="8"
        fill={`url(#${faceId})`}
        stroke="#1e40af"
        strokeWidth="1.5"
      />

      {/* 眼睛 */}
      <circle cx="26" cy="31" r="3.3" fill="#0f172a" />
      <circle cx="38" cy="31" r="3.3" fill="#0f172a" />
      <circle cx="27.2" cy="29.8" r="1.1" fill="#ffffff" />
      <circle cx="39.2" cy="29.8" r="1.1" fill="#ffffff" />

      {/* 微笑与腮红 */}
      <path
        d="M27 36.5 Q32 40.5 37 36.5"
        stroke="#0f172a"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="22" cy="36" r="2.1" fill="#fda4af" opacity="0.85" />
      <circle cx="42" cy="36" r="2.1" fill="#fda4af" opacity="0.85" />

      {/* 小身体 */}
      <path
        d="M23 52 Q32 57.5 41 52"
        stroke="#1e40af"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
