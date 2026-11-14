import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "创意雏形合成助手",
  description:
    "输入痛点、需求、奇思妙想，AI 帮你整合生成完整的项目雏形规划",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        {children}
        {/* 全局 toast 提示 */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
