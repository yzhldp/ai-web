# 创意雏形合成助手

> 输入零散的痛点、需求与奇思妙想，AI 帮你聚合成完整的项目雏形规划。

「创意雏形合成助手」是一款基于 **Next.js 14 App Router** 全栈开发的 AI Web 应用（传智杯 AI Web 参赛项目）。用户往往只有零散的痛点、需求与奇思妙想，却没有成型的项目；本产品通过 AI 整合收拢、补全逻辑，一键生成完整的项目雏形规划。

---

## ✨ 核心功能

- **双模式方案生成**
  - 🛠️ **工具创新**：生成软件开发规划（项目总览、模块划分、技术选型、开发排期等）
  - 💼 **创业创新**：生成创业项目规划（项目定位、商业模式、落地计划、风险对策等）
- **流式 AI 输出**：基于 Vercel AI SDK + DeepSeek API，打字机式实时输出
- **方案迭代优化**：基于当前方案上下文，追加需求持续优化
- **评论交流**：对方案进行评论互动
- **个人方案管理**：历史方案查看、详情、删除、昵称修改
- **悬浮创意助手**：通用问答 + 路由指令识别（如「跳转到工具创新」）
- **完整账号体系**：注册 / 登录 / 退出，JWT + HttpOnly Cookie 安全认证

---

## 🏗️ 技术架构

| 层级 | 技术选型 |
| --- | --- |
| 核心框架 | Next.js 14（App Router）+ TypeScript |
| 样式方案 | Tailwind CSS（原子化样式） |
| UI 组件 | shadcn/ui + lucide-react 图标 |
| 动画交互 | Framer Motion（登录页动效、页面过渡、悬浮交互） |
| 数据库 | SQLite（单文件数据库，无需额外服务） |
| ORM | Prisma |
| 用户认证 | bcryptjs 密码加密 + jose 生成 JWT + HttpOnly Cookie |
| AI 能力 | Vercel AI SDK + DeepSeek API，流式输出 |
| 全局提示 | sonner toast |
| 包管理器 | pnpm |

---

## 📦 安装运行指南

### 环境要求

- Node.js >= 18.17.0
- pnpm >= 8

### 安装步骤

```bash
# 1. 克隆仓库
git clone <your-repo-url>
cd ai-web

# 2. 安装依赖（自动执行 prisma generate）
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY 等信息

# 4. 初始化数据库（生成 SQLite 单文件数据库）
pnpm db:push

# 5. 启动开发服务器
pnpm dev
```

访问 http://localhost:3000 即可使用。

### 生产构建

```bash
pnpm build
pnpm start
```

---

## 🔑 环境变量说明

复制 `.env.example` 为 `.env` 后，按需填写：

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `DATABASE_URL` | SQLite 数据库文件路径 | `file:./dev.db` |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | 在 [platform.deepseek.com](https://platform.deepseek.com) 申请 |
| `DEEPSEEK_BASE_URL` | DeepSeek API 基础地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 使用的模型 | `deepseek-chat` 或 `deepseek-reasoner` |
| `JWT_SECRET` | JWT 签名密钥（生产必改） | 随机长字符串 |

> ⚠️ 请勿将真实的 `.env` 提交到 Git 仓库（已在 `.gitignore` 中忽略）。

---

## 🗂️ 项目结构

```
.
├── prisma/                  # Prisma 数据模型
│   └── schema.prisma
├── src/
│   ├── app/                 # App Router 页面与 API
│   │   ├── api/             # 后端 API 路由
│   │   ├── login/           # 登录注册页
│   │   ├── home/            # 首页
│   │   ├── tool/            # 工具创新页
│   │   ├── business/        # 创业创新页
│   │   ├── profile/         # 个人主页
│   │   └── plans/[id]/      # 方案详情页
│   ├── components/          # UI 组件
│   ├── lib/                 # 工具库（auth/db/ai）
│   └── middleware.ts        # 路由鉴权中间件
├── docs/                    # 技术文档
├── .env.example             # 环境变量模板
└── package.json
```

---

## 👥 团队信息

| 角色 | 姓名（占位） |
| --- | --- |
| 队长 / 全栈开发 | 待填写 |
| 前端开发 | 待填写 |
| 后端开发 | 待填写 |
| 产品 / 设计 | 待填写 |

> 请根据实际团队情况填写成员信息。

---

## 📄 开源协议

本项目为传智杯 AI Web 参赛作品，仅供学习交流使用。
