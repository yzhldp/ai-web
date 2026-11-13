"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, Home, Wrench, Briefcase, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/home", label: "首页", icon: Home },
  { href: "/tool", label: "工具创新", icon: Wrench },
  { href: "/business", label: "创业创新", icon: Briefcase },
  { href: "/profile", label: "个人主页", icon: User },
];

/**
 * 顶部固定导航栏
 * 包含项目 Logo、四个导航项与退出按钮
 */
export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("已退出登录");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("退出失败，请重试");
      setLoggingOut(false);
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">创意雏形合成助手</span>
        </Link>

        {/* 导航项 */}
        <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-md bg-primary/10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* 退出按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">退出</span>
        </Button>
      </div>

      {/* 移动端底部导航 */}
      <nav aria-label="移动端导航" className="flex items-center justify-around border-t py-2 md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 text-xs",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
