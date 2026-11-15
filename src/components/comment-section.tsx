"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Send,
  MessagesSquare,
  ArrowRight,
  Trash2,
  Heart,
  Bookmark,
  Reply,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
  user: { id: string; username: string; nickname: string | null };
  /** 社区讨论流中附带所属方案信息 */
  plan?: { id: string; mode: string };
  /** 当前用户是否可删除（评论作者或方案作者） */
  canDelete?: boolean;
  likeCount?: number;
  favoriteCount?: number;
  liked?: boolean;
  favorited?: boolean;
  replyTo?: { id: string; nickname: string } | null;
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

interface CommentRowProps {
  comment: CommentItem;
  showPlan?: boolean;
  onDelete?: (comment: CommentItem) => void;
  onLike?: (comment: CommentItem) => void;
  onFavorite?: (comment: CommentItem) => void;
  onReply?: (comment: CommentItem) => void;
}

/** 单条评论：头像 / 点赞 / 收藏 / 回复 / 删除 */
function CommentRow({
  comment,
  showPlan = false,
  onDelete,
  onLike,
  onFavorite,
  onReply,
}: CommentRowProps) {
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
      <div className="min-w-0 flex-1">
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
        {comment.replyTo && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            回复 @{comment.replyTo.nickname}
          </p>
        )}
        <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => onLike?.(comment)}
            disabled={!onLike}
            aria-pressed={comment.liked}
            aria-label={comment.liked ? "取消点赞" : "点赞"}
            className={`inline-flex items-center gap-1 transition-colors hover:text-rose-600 ${
              comment.liked ? "text-rose-600" : ""
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 ${comment.liked ? "fill-current" : ""}`}
            />
            {comment.likeCount && comment.likeCount > 0
              ? comment.likeCount
              : "点赞"}
          </button>
          <button
            type="button"
            onClick={() => onFavorite?.(comment)}
            disabled={!onFavorite}
            aria-pressed={comment.favorited}
            aria-label={comment.favorited ? "取消收藏" : "收藏"}
            className={`inline-flex items-center gap-1 transition-colors hover:text-amber-600 ${
              comment.favorited ? "text-amber-600" : ""
            }`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${comment.favorited ? "fill-current" : ""}`}
            />
            {comment.favoriteCount && comment.favoriteCount > 0
              ? comment.favoriteCount
              : "收藏"}
          </button>

          {onReply ? (
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="inline-flex items-center gap-1 transition-colors hover:text-primary"
            >
              <Reply className="h-3.5 w-3.5" />
              回复
            </button>
          ) : showPlan && comment.plan ? (
            <Link
              href={`/plans/${comment.plan.id}#comments`}
              className="inline-flex items-center gap-1 transition-colors hover:text-primary"
            >
              <Reply className="h-3.5 w-3.5" />
              回复
            </Link>
          ) : null}

          {comment.canDelete && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment)}
              aria-label="删除评论"
              className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              删除
            </button>
          )}
        </div>

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
 * 有方案时展示该方案评论并支持评论 / 回复 / 点赞 / 收藏 / 删除；
 * 未生成方案时展示对应类别的社区最新讨论。
 */
export function CommentSection({
  planId,
  mode,
}: {
  planId: string | null;
  mode?: "tool" | "business";
}) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [community, setCommunity] = useState<CommentItem[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; nickname: string } | null>(
    null
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  // 未生成方案时加载当前类别公开项目的社区最新讨论
  const loadCommunity = useCallback(async () => {
    setCommunityLoading(true);
    try {
      const query = new URLSearchParams({ limit: "5" });
      if (mode) query.set("mode", mode);
      const res = await fetch(`/api/comments/community?${query.toString()}`);
      const data = await res.json();
      if (res.ok) setCommunity(data.comments);
    } catch {
      // 忽略加载错误
    } finally {
      setCommunityLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (planId) {
      loadComments();
    } else {
      loadCommunity();
    }
  }, [planId, loadComments, loadCommunity]);

  /** 同步更新方案评论与社区讨论中的同一条评论 */
  function patchComment(id: string, patch: Partial<CommentItem>) {
    setComments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    setCommunity((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  async function toggleLike(comment: CommentItem) {
    const next = !comment.liked;
    try {
      const res = await fetch(`/api/comments/${comment.id}/like`, {
        method: next ? "POST" : "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return;
      }
      patchComment(comment.id, {
        liked: data.liked,
        likeCount: data.likeCount,
      });
    } catch {
      toast.error("网络异常，请重试");
    }
  }

  async function toggleFavorite(comment: CommentItem) {
    const next = !comment.favorited;
    try {
      const res = await fetch(`/api/comments/${comment.id}/favorite`, {
        method: next ? "POST" : "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return;
      }
      patchComment(comment.id, {
        favorited: data.favorited,
        favoriteCount: data.favoriteCount,
      });
    } catch {
      toast.error("网络异常，请重试");
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
      setComments((prev) =>
        prev.filter(
          (item) => item.id !== comment.id && item.parentId !== comment.id
        )
      );
      setCommunity((prev) => prev.filter((item) => item.id !== comment.id));
      toast.success("评论已删除");
    } catch {
      toast.error("网络异常，请重试");
    }
  }

  /** 点击回复：聚焦输入框并展示回复对象 */
  function handleReply(comment: CommentItem) {
    setReplyTo({ id: comment.id, nickname: displayName(comment.user) });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

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
    const isReply = Boolean(replyTo);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          content: content.trim(),
          parentId: replyTo?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "评论失败");
        return;
      }
      setContent("");
      setReplyTo(null);
      toast.success(isReply ? "回复已发布" : "评论发布成功");
      await loadComments();
    } catch {
      toast.error("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  const rootComments = comments.filter((item) => !item.parentId);
  const repliesOf = (id: string) =>
    comments.filter((item) => item.parentId === id);

  return (
    <section
      id="comments"
      className="mt-8 rounded-2xl border bg-white/70 p-6 backdrop-blur"
    >
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
              <CommentRow
                key={comment.id}
                comment={comment}
                showPlan
                onLike={toggleLike}
                onFavorite={toggleFavorite}
              />
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
        <div className="mb-4 space-y-5">
          {rootComments.map((comment) => (
            <div key={comment.id}>
              <CommentRow
                comment={comment}
                onLike={toggleLike}
                onFavorite={toggleFavorite}
                onReply={handleReply}
                onDelete={handleDelete}
              />
              {repliesOf(comment.id).length > 0 && (
                <div className="mt-3 space-y-4 border-l-2 border-muted pl-4 ml-12">
                  {repliesOf(comment.id).map((reply) => (
                    <CommentRow
                      key={reply.id}
                      comment={reply}
                      onLike={toggleLike}
                      onFavorite={toggleFavorite}
                      onReply={handleReply}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 评论输入：仅方案已生成时展示 */}
      {planId ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          {replyTo && (
            <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <span>正在回复 @{replyTo.nickname}</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-primary hover:underline"
              >
                取消回复
              </button>
            </div>
          )}
          <Textarea
            ref={textareaRef}
            placeholder={
              replyTo
                ? `回复 @${replyTo.nickname}（最多 500 字）`
                : "分享你的项目，或对方案技术提问（最多 500 字）"
            }
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
              {submitting ? "发布中..." : replyTo ? "发布回复" : "发布评论"}
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
