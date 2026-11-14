"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X } from "lucide-react";
import { toast } from "sonner";
import { AssistantAvatar } from "@/components/assistant-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  matchLocalIntent,
  OFFLINE_FALLBACK,
  QUICK_QUESTIONS,
} from "@/lib/assistant-faq";

const BALL_SIZE = 64;
const MARGIN = 16;
const POSITION_KEY = "assistant-ball-position";

const ROUTE_MAP: Record<string, string> = {
  tool: "/tool",
  business: "/business",
  profile: "/profile",
  home: "/home",
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Position {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanContent(content: string) {
  return content.replace(/\[\[NAV:\w+\]\]/g, "").trim();
}

/**
 * 悬浮创意助手
 * - 可拖动悬浮球，位置记忆；
 * - 本地 FAQ + 页面跳转，不接 AI 也能用；
 * - 未命中本地意图时调用站内助手接口，失败自动降级。
 */
export function FloatingAssistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);

  const positionRef = useRef<Position | null>(null);
  const dragStartRef = useRef<
    { pointerX: number; pointerY: number; x: number; y: number } | null
  >(null);
  const draggingRef = useRef(false);
  const draggedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 初始化位置 + 监听窗口尺寸变化
  useEffect(() => {
    function updatePosition() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewport({ width, height });

      setPosition((previous) => {
        let next = previous;
        if (!next) {
          try {
            const saved = localStorage.getItem(POSITION_KEY);
            if (saved) {
              const parsed = JSON.parse(saved) as Position;
              if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
                next = parsed;
              }
            }
          } catch {
            // 忽略无效缓存
          }
        }
        if (!next) {
          next = {
            x: width - BALL_SIZE - MARGIN,
            y: height - BALL_SIZE - MARGIN,
          };
        }
        const clamped = {
          x: clamp(next.x, MARGIN, width - BALL_SIZE - MARGIN),
          y: clamp(next.y, MARGIN, height - BALL_SIZE - MARGIN),
        };
        positionRef.current = clamped;
        return clamped;
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, []);

  // 检测 AI 是否接入（仅用于状态提示，不影响离线问答）
  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (active) setAiOnline(Boolean(data?.ai?.textModelConfigured));
      })
      .catch(() => {
        if (active) setAiOnline(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // 新消息自动滚动到底部
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 180);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((previous) => [
      ...previous,
      { id: makeId(), role: "user", content: text },
    ]);

    // 1. 本地 FAQ / 页面跳转：不依赖 AI
    const local = matchLocalIntent(text);
    if (local) {
      window.setTimeout(() => {
        setMessages((previous) => [
          ...previous,
          { id: makeId(), role: "assistant", content: local.reply },
        ]);
      }, 220);

      if (local.path) {
        window.setTimeout(() => {
          router.push(local.path as string);
          toast.success("已为你跳转");
        }, 650);
      }
      return;
    }

    // 2. 未命中本地意图，再请求站内 AI 助手
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "助手暂时不可用");

      const rawReply =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply
          : OFFLINE_FALLBACK;
      const navMatch = rawReply.match(/\[\[NAV:(\w+)\]\]/);
      const reply = cleanContent(rawReply);

      setMessages((previous) => [
        ...previous,
        { id: makeId(), role: "assistant", content: reply },
      ]);

      if (navMatch) {
        const path = ROUTE_MAP[navMatch[1]];
        if (path) {
          window.setTimeout(() => router.push(path), 600);
        }
      }
    } catch {
      setMessages((previous) => [
        ...previous,
        { id: makeId(), role: "assistant", content: OFFLINE_FALLBACK },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const current = positionRef.current;
    if (!current) return;

    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: current.x,
      y: current.y,
    };
    draggingRef.current = true;
    draggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current || !dragStartRef.current) return;

    const start = dragStartRef.current;
    const dx = event.clientX - start.pointerX;
    const dy = event.clientY - start.pointerY;
    if (Math.abs(dx) + Math.abs(dy) > 5) draggedRef.current = true;

    const next = {
      x: clamp(start.x + dx, MARGIN, window.innerWidth - BALL_SIZE - MARGIN),
      y: clamp(start.y + dy, MARGIN, window.innerHeight - BALL_SIZE - MARGIN),
    };
    positionRef.current = next;
    setPosition(next);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    if (draggedRef.current && positionRef.current) {
      localStorage.setItem(POSITION_KEY, JSON.stringify(positionRef.current));
      // 让紧随其后的 click 事件被忽略，避免拖拽结束误触展开
      window.setTimeout(() => {
        draggedRef.current = false;
      }, 60);
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 指针已释放时忽略
    }
  }

  function handleBallClick() {
    if (draggedRef.current) return;
    setOpen((value) => !value);
  }

  // 面板位置：优先出现在悬浮球上方，空间不足时出现在下方
  const panelWidth = Math.min(360, Math.max(280, viewport.width - 24));
  const panelHeight = Math.min(480, Math.max(280, viewport.height - 140));
  let panelLeft = Math.max(12, viewport.width - panelWidth - 16);
  let panelTop = 16;

  if (position) {
    panelLeft = clamp(
      position.x + BALL_SIZE - panelWidth,
      12,
      Math.max(12, viewport.width - panelWidth - 12)
    );
    panelTop = position.y - panelHeight - 12;
    if (panelTop < 12) {
      panelTop = clamp(
        position.y + BALL_SIZE + 12,
        12,
        Math.max(12, viewport.height - panelHeight - 12)
      );
    }
  }

  const statusText =
    aiOnline === false
      ? "离线问答模式 · 可拖动"
      : aiOnline
        ? "AI 在线 · 可拖动"
        : "项目问答 · 可拖动";

  return (
    <>
      {/* 可拖动卡通悬浮球 */}
      <button
        type="button"
        aria-label={open ? "关闭创意助手（可拖动）" : "打开创意助手（可拖动）"}
        aria-expanded={open}
        title="可拖动，点击聊天"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onClick={handleBallClick}
        style={position ? { left: position.x, top: position.y } : undefined}
        className={`fixed z-50 flex h-16 w-16 touch-none select-none items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 shadow-xl shadow-blue-500/40 ring-4 ring-white/70 transition-transform hover:scale-105 active:scale-95 ${
          position ? "cursor-grab active:cursor-grabbing" : "bottom-6 right-6"
        }`}
      >
        <AssistantAvatar className="h-12 w-12 drop-shadow-sm" />

        {/* 关闭角标 */}
        {open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white">
            <X className="h-3 w-3" />
          </span>
        )}

        {/* AI / 离线状态点 */}
        <span
          className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
            aiOnline ? "bg-emerald-400" : "bg-amber-400"
          }`}
          title={aiOnline ? "AI 已接入" : "离线问答模式"}
        />
      </button>

      {/* 对话面板 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{
              left: panelLeft,
              top: panelTop,
              width: panelWidth,
              height: panelHeight,
            }}
            className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
          >
            {/* 头部 */}
            <div className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/30">
                <AssistantAvatar className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">创意小蓝</p>
                <p className="truncate text-[11px] text-white/80">{statusText}</p>
              </div>
              <button
                type="button"
                aria-label="关闭创意助手"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 消息列表 */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto p-3.5"
            >
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AssistantAvatar className="mt-0.5 h-7 w-7 shrink-0" />
                    <div className="rounded-xl rounded-tl-sm bg-muted px-3 py-2 text-xs leading-relaxed">
                      你好，我是创意小蓝。可以拖动我到任意位置，也可以问我项目使用问题或让我帮你跳转页面。
                    </div>
                  </div>

                  <div className="space-y-1.5 pl-9">
                    {QUICK_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => send(question)}
                        className="block w-full rounded-lg border bg-background px-2.5 py-1.5 text-left text-[11px] transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-2 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <AssistantAvatar className="mt-0.5 h-7 w-7 shrink-0" />
                  )}
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      message.role === "user"
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm bg-muted"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-start gap-2">
                  <AssistantAvatar className="mt-0.5 h-7 w-7 shrink-0" />
                  <div className="rounded-xl rounded-tl-sm bg-muted px-3 py-2 text-xs text-muted-foreground">
                    正在思考...
                  </div>
                </div>
              )}
            </div>

            {/* 输入区 */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
              className="flex items-center gap-2 border-t p-3"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="问项目问题，或说「跳转到工具创新」"
                className="flex-1 text-xs"
                maxLength={500}
                aria-label="向创意助手提问"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="发送消息"
                disabled={loading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>

            <p className="border-t bg-muted/30 px-3 py-1.5 text-center text-[10px] text-muted-foreground">
              {aiOnline === false
                ? "未接入 AI，仍可回答项目问题与跳转页面"
                : "支持项目问答、功能说明与页面跳转"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
