import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { ProfileView } from "@/components/profile-view";
import { getCurrentUser } from "@/lib/auth";

/**
 * 个人主页 /profile（需登录鉴权）
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <ProfileView initialUser={user} />
    </div>
  );
}
