"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Send, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; username: string; nickname: string | null };
}

/** 格式化时间 */
function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 显示昵称（无昵称则用账号） */
function displayName(user: CommentItem["user"]) {
  return user.nickname || user.username;
}

/**
 * 评论区组件
 * 展示当前方案的所有评论，支持发布新评论
 */
export function CommentSection({ planId }: { planId: string | null }) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 方案变化时重新加载评论
  const loadComments = useCallback(async () => {
    if (!planId) {
      setComments([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?planId=${planId}`);
      const data = await res.json();
      if (res.ok) setComments(data.comments);
    } catch {
      // 忽略加载错误
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!planId) {
      toast.error("请先生成方案后再评论");
      return;
    }
    if (!content.trim()) {
      toast.error("评论内容不能为空");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "评论失败");
        return;
      }
      setComments((prev) => [...prev, data.comment]);
      setContent("");
      toast.success("评论发布成功");
    } catch {
      toast.error("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border bg-white/70 p-6 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <MessagesSquare className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">评论区</h3>
        <span className="text-sm text-muted-foreground">
          （{comments.length} 条评论，点击头像可查看对方公开项目）
        </span>
      </div>

      {/* 评论列表 */}
      {!planId ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          生成方案后即可参与评论交流
        </p>
      ) : loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          评论加载中...
        </p>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          暂无评论，快来发表第一条看法吧
        </p>
      ) : (
        <div className="mb-4 space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Link
                href={`/users/${comment.user.id}`}
                aria-label={`查看 ${displayName(comment.user)} 的个人主页`}
                title="查看个人主页"
                className="shrink-0 rounded-full ring-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-sm">
                    {displayName(comment.user).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <Link
                    href={`/users/${comment.user.id}`}
                    className="text-sm font-semibold hover:text-primary hover:underline"
                  >
                    {displayName(comment.user)}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 评论输入 */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          placeholder="分享你的项目，或对方案技术提问（最多 500 字）"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          rows={3}
          aria-label="评论内容"
        />
        <div className="flex items-center justify-end gap-3">
          <span className="text-[11px] text-muted-foreground">{content.length}/500</span>
          <Button type="submit" disabled={submitting} className="gap-2">
            <Send className="h-4 w-4" />
            {submitting ? "发布中..." : "发布评论"}
          </Button>
        </div>
      </form>
    </section>
  );
}
