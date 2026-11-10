/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 生成 standalone 产物，便于容器化与云平台部署
  output: "standalone",
  // 允许 Vercel AI SDK 流式输出正常工作
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
