"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 删除评论按钮
 * 用于方案详情页等服务器组件场景，删除成功后刷新页面数据。
 */
export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("确定删除这条评论吗？删除后不可恢复")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "删除失败");
        return;
      }
      toast.success("评论已删除");
      router.refresh();
    } catch {
      toast.error("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={loading}
      onClick={handleDelete}
      aria-label="删除评论"
      className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-3 w-3" />
      {loading ? "删除中" : "删除"}
    </Button>
  );
}
