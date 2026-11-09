import { Navbar } from "@/components/navbar";
import { PlanWorkspace } from "@/components/plan-workspace";

/**
 * 工具创新页 /tool（需登录鉴权）
 */
export default function ToolPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24">
        <PlanWorkspace mode="tool" />
      </main>
    </div>
  );
}
