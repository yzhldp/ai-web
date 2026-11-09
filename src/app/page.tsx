import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/**
 * 默认首页：根据登录状态重定向
 * 未登录 -> /login，已登录 -> /home
 */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/home" : "/login");
}
