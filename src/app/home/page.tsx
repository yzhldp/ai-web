import { Navbar } from "@/components/navbar";
import { FloatingAssistant } from "@/components/floating-assistant";
import { HomeHero } from "@/components/home-hero";

/**
 * 首页 /home（需登录鉴权，由中间件保护）
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        <HomeHero />
      </main>
      <FloatingAssistant />
    </div>
  );
}
