"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { User, Lock } from "lucide-react";
import { ComicCharacter } from "@/components/comic-character";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/**
 * 登录注册页
 * 左右分栏布局：左侧品牌展示 + 漫画小人动画，右侧登录/注册表单
 */
export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  // 登录表单
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // 注册表单
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  /** 登录提交 */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) {
      toast.error("请输入账号和密码");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "登录失败");
        return;
      }
      toast.success("登录成功，欢迎回来！");
      router.push("/home");
      router.refresh();
    } catch {
      toast.error("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  /** 注册提交 */
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const username = regUsername.trim();

    // 前端校验
    if (username.length < 1 || username.length > 20) {
      toast.error("账号长度需在 1-20 位之间");
      return;
    }
    if (regPassword.length < 8 || regPassword.length > 20) {
      toast.error("密码长度需在 8-20 位之间");
      return;
    }
    if (/^\d+$/.test(regPassword)) {
      toast.error("密码不能为纯数字");
      return;
    }
    if (regPassword !== regConfirm) {
      toast.error("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: regPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "注册失败");
        return;
      }
      toast.success("注册成功，已自动登录！");
      router.push("/home");
      router.refresh();
    } catch {
      toast.error("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      {/* 左侧品牌展示区（窄屏在上，大屏在左） */}
      <div className="flex w-full flex-col items-center justify-between bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 px-4 py-6 sm:px-6 lg:flex-1 lg:px-8 lg:py-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-4 w-full text-center sm:mt-6"
        >
          <h1 className="text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
            创意雏形合成助手
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 sm:text-lg">
            输入零散的痛点、需求与奇思妙想，AI 帮你聚合成完整的项目雏形规划
          </p>
        </motion.div>

        {/* 漫画小人动画：随左侧面板宽度等比缩放，尽量铺满 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex w-full flex-1 items-center justify-center py-2"
        >
          <div className="relative aspect-[10/10.5] w-[320px] shrink-0 min-[480px]:w-[420px] sm:w-[440px] md:w-[600px] lg:w-[440px] xl:w-[540px] 2xl:w-[620px]">
            <div className="origin-top-left scale-[0.8] min-[480px]:scale-[1.05] sm:scale-[1.1] md:scale-[1.5] lg:scale-[1.1] xl:scale-[1.35] 2xl:scale-[1.55]">
              <ComicCharacter />
            </div>
          </div>
        </motion.div>

        <p className="pb-2 text-sm text-slate-500">
          © 2026 创意雏形合成助手 · 让灵感快速落地
        </p>
      </div>

      {/* 右侧表单区（窄屏在下，大屏在右） */}
      <div className="flex w-full items-center justify-center bg-background px-6 py-12 lg:flex-1">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <h2 className="mb-6 text-2xl font-bold">欢迎使用</h2>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "login" | "register")}
          >
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>

            {/* 登录表单 */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">账号</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-username"
                      className="pl-9"
                      placeholder="请输入账号（1-20位）"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      className="pl-9"
                      placeholder="请输入密码"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "登录中..." : "登录"}
                </Button>
              </form>
            </TabsContent>

            {/* 注册表单 */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">账号</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-username"
                      className="pl-9"
                      placeholder="请输入账号（1-20位）"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-password"
                      type="password"
                      className="pl-9"
                      placeholder="请输入密码（8-20位，非纯数字）"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">确认密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-confirm"
                      type="password"
                      className="pl-9"
                      placeholder="请再次输入密码"
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "注册中..." : "注册"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            注册即代表同意遵守平台使用规范
          </p>
        </motion.div>
      </div>
    </div>
  );
}
