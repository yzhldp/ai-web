import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { describeProviders } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/agent/models —— 供应商路由状态（脱敏，不含密钥） */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  return NextResponse.json({
    ...describeProviders(),
    evaluation: {
      tests: ["结构化 JSON", "Function Calling", "引用标记"],
      note: "评测会真实消耗 Token；每用户每小时最多运行 3 次。",
    },
  });
}
