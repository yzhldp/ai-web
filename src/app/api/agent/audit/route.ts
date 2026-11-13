import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAuditSummary, listAuditLogs } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/audit —— 当前用户的 AI 调用审计与用量统计 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 20);

  const [logs, summary] = await Promise.all([
    listAuditLogs(user.id, Number.isFinite(limit) ? limit : 20),
    getAuditSummary(user.id),
  ]);

  return NextResponse.json({ logs, summary });
}
