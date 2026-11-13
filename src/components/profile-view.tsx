"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Wrench,
  Briefcase,
  Trash2,
  Eye,
  LogOut,
  Pencil,
  Check,
  X,
  Activity,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/markdown";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButtons } from "@/components/export-buttons";

interface UserInfo {
  id: string;
  username: string;
  nickname: string | null;
}

interface PlanItem {
  id: string;
  mode: string;
  painPoint: string;
  demand: string;
  idea: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/** 截取方案内容预览 */
function preview(content: string, len = 80) {
  const clean = content.replace(/[#>*`\-\n]/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > len ? clean.slice(0, len) + "..." : clean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 个人主页视图
 * 用户信息区 + Tab 方案管理 + 退出登录
 */
export function ProfileView({ initialUser }: { initialUser: UserInfo }) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo>(initialUser);

  // 昵称编辑
  const [editing, setEditing] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(initialUser.nickname ?? "");

  // 方案列表
  const [toolPlans, setToolPlans] = useState<PlanItem[]>([]);
  const [businessPlans, setBusinessPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 详情弹窗
  const [detailPlan, setDetailPlan] = useState<PlanItem | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const [toolRes, bizRes] = await Promise.all([
        fetch("/api/plans?mode=tool"),
        fetch("/api/plans?mode=business"),
      ]);
      const toolData = await toolRes.json();
      const bizData = await bizRes.json();
      if (toolRes.ok) setToolPlans(toolData.plans);
      if (bizRes.ok) setBusinessPlans(bizData.plans);
    } catch {
      toast.error("方案加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  /** 保存昵称 */
  async function handleSaveNickname() {
    const trimmed = nicknameInput.trim();
    if (trimmed.length > 20) {
      toast.error("昵称长度不能超过 20 位");
      return;
    }
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "修改失败");
        return;
      }
      setUser(data.user);
      setEditing(false);
      toast.success("昵称已更新");
    } catch {
      toast.error("网络异常，请重试");
    }
  }

  /** 删除方案 */
  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/plans/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("删除失败");
        return;
      }
      setToolPlans((prev) => prev.filter((p) => p.id !== id));
      setBusinessPlans((prev) => prev.filter((p) => p.id !== id));
      toast.success("方案已删除");
    } catch {
      toast.error("网络异常，请重试");
    }
  }

  /** 退出登录 */
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("已退出登录");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("退出失败，请重试");
    }
  }

  /** 方案卡片 */
  function PlanCard({ plan }: { plan: PlanItem }) {
    return (
      <div className="flex flex-col rounded-xl border bg-white p-4 transition-shadow hover:shadow-md">
        <div className="mb-2 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              plan.mode === "tool"
                ? "bg-blue-100 text-blue-700"
                : "bg-sky-100 text-sky-700"
            }`}
          >
            {plan.mode === "tool" ? (
              <Wrench className="h-3 w-3" />
            ) : (
              <Briefcase className="h-3 w-3" />
            )}
            {plan.mode === "tool" ? "工具创新" : "创业创新"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(plan.updatedAt)}
          </span>
        </div>
        <p className="mb-4 flex-1 text-sm text-muted-foreground">
          {preview(plan.content)}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1"
            onClick={() => setDetailPlan(plan)}
          >
            <Eye className="h-3.5 w-3.5" />
            查看详情
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1"
            onClick={() => {
              if (confirm("确定删除该方案吗？删除后不可恢复")) {
                handleDelete(plan.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </Button>
        </div>
      </div>
    );
  }

  function PlanList({ plans }: { plans: PlanItem[] }) {
    if (loading) {
      return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          加载中...
        </p>
      );
    }
    if (plans.length === 0) {
      return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          暂无方案，快去生成你的第一个创意雏形吧
        </p>
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-24">
      {/* 用户信息区 */}
      <div className="mb-8 flex flex-col items-center rounded-2xl border bg-white/70 p-8 backdrop-blur">
        <Avatar className="h-20 w-20 text-3xl">
          <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-500 text-3xl font-bold">
            {(user.nickname || user.username).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* 昵称 / 账号 */}
        <div className="mt-3 flex items-center gap-2">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="输入昵称"
                className="h-9 w-40"
                autoFocus
              />
              <Button size="icon" variant="ghost" aria-label="保存昵称" onClick={handleSaveNickname}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="取消修改昵称"
                onClick={() => {
                  setEditing(false);
                  setNicknameInput(user.nickname ?? "");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => {
                setNicknameInput(user.nickname ?? "");
                setEditing(true);
              }}
              className="group flex items-center gap-1 text-xl font-bold"
            >
              {user.nickname || "点击设置昵称"}
              <Pencil className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">账号：{user.username}</p>
      </div>

      {/* 方案 Tab 分区 */}
      <Tabs defaultValue="tool">
        <TabsList className="mb-6 grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="tool" className="gap-1">
            <Wrench className="h-4 w-4" />
            工具创新
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-1">
            <Briefcase className="h-4 w-4" />
            创业创新
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1">
            <Activity className="h-4 w-4" />
            AI 审计
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tool">
          <PlanList plans={toolPlans} />
        </TabsContent>
        <TabsContent value="business">
          <PlanList plans={businessPlans} />
        </TabsContent>
        <TabsContent value="audit">
          <div className="rounded-2xl border bg-white/70 p-5 backdrop-blur">
            <AuditPanel />
          </div>
        </TabsContent>
      </Tabs>

      {/* 详情弹窗 */}
      <Dialog
        open={!!detailPlan}
        onOpenChange={(open) => !open && setDetailPlan(null)}
      >
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailPlan?.mode === "tool" ? "工具创新方案" : "创业创新方案"}
            </DialogTitle>
            <DialogDescription>
              生成于 {detailPlan && formatTime(detailPlan.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {detailPlan && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/plans/${detailPlan.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  打开独立详情页
                </Link>
                <ExportButtons
                  content={detailPlan.content}
                  title={
                    detailPlan.mode === "tool" ? "工具创新方案" : "创业创新方案"
                  }
                />
              </div>
              <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <p>
                  <span className="font-semibold">痛点：</span>
                  {detailPlan.painPoint || "未填写"}
                </p>
                <p>
                  <span className="font-semibold">需求：</span>
                  {detailPlan.demand || "未填写"}
                </p>
                <p>
                  <span className="font-semibold">奇思妙想：</span>
                  {detailPlan.idea || "未填写"}
                </p>
              </div>
              <Markdown content={detailPlan.content} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 退出登录 */}
      <div className="mt-12 flex justify-center">
        <Button
          variant="outline"
          onClick={handleLogout}
          className="gap-2 text-destructive"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </Button>
      </div>
    </div>
  );
}
