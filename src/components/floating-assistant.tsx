"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "ai/react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** 路由指令映射：[[NAV:tool]] -> /tool */
const ROUTE_MAP: Record<string, string> = {
  tool: "/tool",
  business: "/business",
  profile: "/profile",
  home: "/home",
};

/** 去除回复中的路由指令标记，用于展示 */
function cleanContent(content: string) {
  return content.replace(/\[\[NAV:\w+\]\]/g, "").trim();
}

/**
 * 悬浮创意助手
 * 右下角固定悬浮球，点击展开对话面板；
 * 支持通用问答 + 路由指令识别（如「跳转到工具创新」）
 */
export function FloatingAssistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useChat({
    api: "/api/chat",
    body: { action: "assistant" },
    onFinish: (message) => {
      // 识别并执行路由跳转指令
      const match = message.content.match(/\[\[NAV:(\w+)\]\]/);
      if (match) {
        const path = ROUTE_MAP[match[1]];
        if (path) {
          router.push(path);
        }
      }
    },
  });

  return (
    <>
      {/* 悬浮球按钮 */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "关闭创意助手" : "打开创意助手"}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/40"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </motion.button>

      {/* 对话面板 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 flex h-[480px] w-[360px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
          >
            {/* 头部 */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-white">
              <Sparkles className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">创意助手</p>
                <p className="text-xs text-white/80">随时为你解答产品疑问</p>
              </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  试试问我「跳转到工具创新」或「这个产品怎么用」
                </p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {cleanContent(msg.content)}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                    思考中...
                  </div>
                </div>
              )}
            </div>

            {/* 输入区 */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t p-3"
            >
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="输入你的问题..."
                className="flex-1"
              />
              <Button type="submit" size="icon" aria-label="发送消息" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
