import { Navbar } from "@/components/navbar";
import { PlanWorkspace } from "@/components/plan-workspace";

/**
 * 创业创新页 /business（需登录鉴权）
 */
export default function BusinessPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24">
        <PlanWorkspace mode="business" />
      </main>
    </div>
  );
}
