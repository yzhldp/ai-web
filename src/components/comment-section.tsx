"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Send, MessagesSquare, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; username: string; nickname: string | null };
  /** 社区讨论流中附带所属方案信息 */
  plan?: { id: string; mode: string };
  /** 当前用户是否可删除（评论作者或方案作者） */
  canDelete?: boolean;
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

/** 单条评论：头像与昵称均可跳转到评论者公开主页 */
function CommentRow({
  comment,
  showPlan = false,
  onDelete,
}: {
  comment: CommentItem;
  showPlan?: boolean;
  onDelete?: (comment: CommentItem) => void;
}) {
  return (
    <div className="flex gap-3">
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
          {comment.canDelete && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment)}
              aria-label="删除评论"
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              删除
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
        {showPlan && comment.plan && (
          <Link
            href={`/plans/${comment.plan.id}`}
            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            来自：
            {comment.plan.mode === "tool" ? "工具创新" : "创业创新"}方案
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * 评论区组件
 * 有方案时展示该方案评论并支持发布；未生成方案时展示公开项目的社区最新讨论。
 */
export function CommentSection({ planId }: { planId: string | null }) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [community, setCommunity] = useState<CommentItem[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 方案变化时重新加载该方案评论
  const loadComments = useCallback(async () => {
    if (!planId) return;
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

  // 未生成方案时加载公开项目的社区最新讨论
  const loadCommunity = useCallback(async () => {
    setCommunityLoading(true);
    try {
      const res = await fetch("/api/comments/community?limit=5");
      const data = await res.json();
      if (res.ok) setCommunity(data.comments);
    } catch {
      // 忽略加载错误
    } finally {
      setCommunityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (planId) {
      loadComments();
    } else {
      loadCommunity();
    }
  }, [planId, loadComments, loadCommunity]);

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

  /** 删除评论（评论作者或方案作者） */
  async function handleDelete(comment: CommentItem) {
    if (!confirm("确定删除这条评论吗？删除后不可恢复")) return;
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "删除失败");
        return;
      }
      setComments((prev) => prev.filter((item) => item.id !== comment.id));
      toast.success("评论已删除");
    } catch {
      toast.error("网络异常，请重试");
    }
  }

  return (
    <section className="mt-8 rounded-2xl border bg-white/70 p-6 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <MessagesSquare className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">评论区</h3>
        <span className="text-sm text-muted-foreground">
          （
          {planId ? `${comments.length} 条评论` : "社区最新讨论"}
          ，点击头像可查看对方公开项目）
        </span>
      </div>

      {/* 未生成方案：展示社区最新讨论 */}
      {!planId ? (
        communityLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            社区讨论加载中...
          </p>
        ) : community.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            暂无社区讨论，生成方案后即可发表你的看法
          </p>
        ) : (
          <div className="mb-4 space-y-4">
            {community.map((comment) => (
              <CommentRow key={comment.id} comment={comment} showPlan />
            ))}
          </div>
        )
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
            <CommentRow
              key={comment.id}
              comment={comment}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* 评论输入：仅方案已生成时展示 */}
      {planId ? (
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
            <span className="text-[11px] text-muted-foreground">
              {content.length}/500
            </span>
            <Button type="submit" disabled={submitting} className="gap-2">
              <Send className="h-4 w-4" />
              {submitting ? "发布中..." : "发布评论"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
          <p>生成并保存方案后，就可以在这里与大家讨论你的项目</p>
          <Link
            href="/home"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            去首页社区精选查看更多
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
