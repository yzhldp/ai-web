# 创意雏形合成助手

> 输入零散的痛点、需求与奇思妙想，AI Agent 帮你聚合成完整、可执行、可追溯的项目雏形规划。

「创意雏形合成助手」是一款基于 **Next.js 14 App Router** 全栈开发的 AI Web 应用（传智杯 AI Web 参赛项目）。用户往往只有零散的痛点、需求与奇思妙想，却没有成型的项目；本产品通过 **多阶段 Agent 工作流 + RAG 检索增强 + 工具调用 + 多模态理解**，一键生成结构化、有依据、可质检的项目雏形规划。

- 仓库地址：<https://github.com/yzhldp/ai-web>
- 技术栈：Next.js 14 + TypeScript + Prisma + Vercel AI SDK + DeepSeek
- 部署方式：Docker Compose 一键启动

---

## ✨ 核心能力

### Agent 多阶段工作流（可观测）

```
需求解析 → 知识检索 → 工具推理 → 方案生成 → 质检与架构图
```

- 每个阶段通过 SSE 推送状态、耗时与中间结论，前端时间线实时展示；
- 支持「深度模式」（完整五阶段）与「快速模式」（单次生成）；
- 支持中途停止、失败降级，生成过程不再是黑盒。

### RAG 检索增强

- 内置 8 篇领域知识、32 个知识切块：技术选型、AI 架构、商业模式、MVP、排期、合规、行业案例、交互设计；
- 中文二元组分词 + 同义词扩展，**BM25 + 稀疏向量余弦混合检索**；
- 生成内容标注 `[编号]` 来源，前端可查看每条依据的双通道得分；
- 内置 10 条标注评测集，一键查看 **Recall@6 / HitRate / MRR**，量化检索效果；
- 无需外部向量数据库，Docker 单机即可运行。

### Function Calling 工具集成

- `search_knowledge_base`：知识库检索
- `recommend_tech_stack`：按场景 / 团队规模推荐技术栈
- `estimate_schedule`：按模块数与复杂度估算排期
- `risk_checklist`：生成技术 / 市场 / 合规风险清单
- `web_search`：通过 Tavily 联网获取最新政策、市场价格与竞品动态

工具参数由 Zod 约束；模型不支持工具调用时自动切换确定性规则引擎。

### 多供应商路由与自动故障转移

- 支持 DeepSeek / 通义千问 / Moonshot / OpenAI / Ollama 任意 OpenAI 兼容服务；
- 通过环境变量启用供应商，按优先级自动切换；非流式调用遇到超时、报错或非法 JSON 都会切换下一家；
- 流式生成在首 Token 之前失败可无缝切换，开始输出后不切换，避免内容重复；
- 工作台实时显示本次使用的供应商、模型与切换次数，个人主页可运行真实模型质量评测（结构化 JSON / Function Calling / 引用标记）。

### 多模态能力

- **图片输入**：上传界面截图、手绘草图、白板照片，由视觉模型理解并注入需求；
- **图表输出**：自动生成 Mermaid 架构图，支持导出 SVG；
- 未配置视觉模型时自动降级并提示。

### AI 安全与可控

- 提示词注入检测、违法违规内容拦截；
- 手机号 / 邮箱 / 身份证号脱敏；
- 输出内部标记清理、AI 生成声明、超长截断；
- 用户级分钟 / 日级限流；
- `AiAuditLog` 记录每次调用的耗时、Token、检索数、工具数与安全标记，个人主页可查。

### 其他功能

- 双模式：🛠️ 工具创新（软件开发规划） / 💼 创业创新（商业项目规划）
- 方案迭代复用完整 Agent 工作流，迭代后自动刷新知识依据、质检与架构图
- 方案详情支持导出 Markdown、打印 / 另存 PDF
- 方案自动保存、评论交流、历史方案管理
- **公开 / 私有项目**：个人主页可一键切换项目可见性；公开项目展示在个人公开主页与首页「社区精选」，并允许其他登录用户浏览与评论
- **社区化评论区**：预置项目分享与技术问答示例；点击评论者头像即可进入其公开主页查看公开项目
- 可拖拽卡通悬浮助手「创意小蓝」：位置记忆、本地 FAQ、页面跳转；未接入 AI 也可用，接入后自动增强
- 账号体系：注册 / 登录 / 退出，JWT + HttpOnly Cookie；私有方案与评论仅作者可见，公开方案开放社区交流

---

## 🏗️ 技术架构

| 层级 | 技术选型 |
| --- | --- |
| 核心框架 | Next.js 14（App Router）+ TypeScript（strict） |
| 样式方案 | Tailwind CSS |
| UI 组件 | shadcn/ui + lucide-react |
| 动画交互 | Framer Motion |
| 数据库 | SQLite（单文件，零额外服务） |
| ORM | Prisma |
| 用户认证 | bcryptjs + jose JWT + HttpOnly Cookie |
| AI 能力 | Vercel AI SDK + 多供应商（DeepSeek / Qwen / Moonshot / OpenAI / Ollama），自动故障转移 |
| 结构化输出 | JSON 提示词 + Zod Schema 校验 |
| 检索 | 自研 BM25 + 稀疏向量混合检索 |
| 图表 | Mermaid（按需动态加载） |
| 校验 | Zod |
| 部署 | Docker + Docker Compose |

AI 技术细节见 [docs/04-AI技术方案.md](docs/04-AI技术方案.md)，评审逐项对标见 [docs/10-评审对标说明.md](docs/10-评审对标说明.md)。

### 依赖清单

| 类别 | 主要依赖 | 版本 |
| --- | --- | --- |
| 运行时 | Node.js | >= 18.17 |
| 包管理器 | pnpm | 10.x（随 `pnpm-lock.yaml` 锁定） |
| 框架 | next / react / react-dom | 14.2.x / 18.3.x |
| 语言 | typescript | 5.x |
| 数据库 | @prisma/client / prisma | 5.22.x |
| AI | ai / @ai-sdk/openai | 4.1.x / 1.1.x |
| 结构化校验 | zod | 3.25.x |
| 检索与图表 | mermaid | 12.x |
| 样式与组件 | tailwindcss / shadcn-ui / lucide-react | 3.4.x / — / 0.454.x |
| 认证与安全 | bcryptjs / jose | 2.4.x / 5.9.x |
| 动画 | framer-motion | 11.x |

完整依赖与精确版本见 `package.json` 与 `pnpm-lock.yaml`。

---

## 📦 本地运行

### 环境要求

- Node.js >= 18.17
- pnpm >= 9

```bash
# 1. 安装依赖（自动执行 prisma generate）
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少填写一个模型供应商密钥（如 DEEPSEEK_API_KEY）与 JWT_SECRET

# 3. 初始化数据库
pnpm db:push

# 4. 启动开发服务器
pnpm dev
```

访问 http://localhost:3000。

### 生产构建

```bash
pnpm build
pnpm start
```

### 评审快速体验（3 分钟）

1. 启动服务（Docker Compose 或 `pnpm dev`），确保至少配置了一个模型供应商密钥；
2. 注册账号，进入 `/tool` 或 `/business`；
3. 点击「填入示例」→「创新合成」，观察五阶段 Agent 时间线；
4. 切换「依据 / 质检 / 架构图 / 知识库」标签，查看检索得分、质量评分与架构图；
5. 在「知识库」标签点击「运行评测」，查看 Recall@6 / HitRate / MRR；
6. 在方案下方追加补充需求，验证迭代会重新执行 Agent 并刷新质检与架构图；
7. 打开「个人主页 → AI 审计」，查看模型路由、Token 消耗、自动切换次数与模型评测；
8. 在「个人主页」将项目设为公开，返回首页查看「社区精选」，进入项目评论区并点击头像查看他人公开主页。

> 演示账号（Docker 启动时自动初始化，可用 `SEED_DEMO_DATA=false` 关闭）：`linxiaoman` / `chenyiming` / `suqing` / `zhouye`，密码统一为 `demo1234`。

### 开发与测试

```bash
pnpm lint          # ESLint
pnpm test          # Vitest 单元测试
pnpm exec tsc --noEmit
pnpm build         # 生产构建
```

---

## 🐳 Docker 部署（推荐）

### 方式一：Docker Compose

```bash
cp .env.docker.example .env.docker
# 编辑 .env.docker：填写 DEEPSEEK_API_KEY，并将 JWT_SECRET 改为随机长字符串
docker compose up -d --build

# 查看状态与健康检查
docker compose ps
curl http://localhost:3000/api/health
```

Compose 会：

- 构建生产镜像（多阶段构建，非 root 用户运行）；
- 启动时自动执行 `prisma db push`；
- 将 SQLite 数据挂载到命名卷 `creative-prototype-assistant-data`，重启不丢数据；
- 每 30 秒执行一次 `/api/health` 健康检查。

### 方式二：docker run

```bash
docker build -t creative-prototype-assistant:1.0.0 .

docker run -d --name creative-assistant -p 3000:3000 \
  --env-file .env.docker \
  -v creative-data:/app/data \
  creative-prototype-assistant:1.0.0
```

容器内 `DATABASE_URL` 默认 `file:/app/data/prod.db`，请确保数据目录挂载到持久卷。

### 常用命令

```bash
docker compose logs -f app        # 查看日志
docker compose restart app        # 重启
docker compose down               # 停止（保留数据卷）
docker compose down -v            # 停止并删除数据（谨慎）
```

---

## 🔑 环境变量

| 变量名 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | SQLite 文件路径（Docker 内为 `/app/data/prod.db`） | `file:./dev.db` |
| `DEEPSEEK_API_KEY` | 否* | DeepSeek 密钥（默认主供应商） | 在 platform.deepseek.com 申请 |
| `DASHSCOPE_API_KEY` | 否* | 通义千问密钥 | 阿里云 DashScope |
| `MOONSHOT_API_KEY` | 否* | Moonshot 密钥 | — |
| `OPENAI_API_KEY` | 否* | OpenAI 密钥 | — |
| `OLLAMA_BASE_URL` | 否* | 本地 Ollama 地址，填写即启用 | `http://host.docker.internal:11434/v1` |
| `AI_PROVIDER_ORDER` | 否 | 供应商优先级与白名单，逗号分隔 | `deepseek,qwen,openai` |
| `AI_DISABLE_FALLBACK` | 否 | 关闭自动切换，仅用第一个供应商 | `true` / `false` |
| `TAVILY_API_KEY` | 否 | 联网搜索工具密钥（启用 `web_search`） | 在 tavily.com 申请 |
| `JWT_SECRET` | 是 | JWT 签名密钥（生产务必修改） | `openssl rand -base64 48` |
| `VISION_MODEL` | 否 | 视觉模型名称，用于参考图理解 | `qwen-vl-max` / `gpt-4o-mini` |
| `VISION_BASE_URL` | 否 | 视觉模型 OpenAI 兼容地址 | — |
| `VISION_API_KEY` | 否 | 视觉模型密钥（默认复用供应商密钥） | — |

> \* 至少配置一个文本模型供应商。未配置视觉模型时，图片输入自动降级，文本生成与架构图不受影响。

---

## 🔌 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/agent/generate` | Agent 生成，SSE 推送阶段 / Token / 依据 / 工具 / 质检事件 |
| POST | `/api/chat` | 快速生成、方案迭代 |
| POST | `/api/assistant` | 悬浮助手问答（未接 AI 时返回离线提示） |
| POST | `/api/knowledge` | 混合检索调试（返回双通道得分） |
| GET | `/api/knowledge` | 知识库统计信息 |
| GET | `/api/agent/audit` | AI 调用审计与用量统计 |
| GET | `/api/agent/models` | 多供应商路由状态（脱敏） |
| POST | `/api/agent/models/evaluate` | 运行模型质量评测（结构化 / 工具 / 引用） |
| GET | `/api/health` | 健康检查（数据库、知识库、模型配置） |
| GET/POST | `/api/plans` | 方案列表 / 保存（含 `visibility` 公开状态） |
| GET/PATCH/DELETE | `/api/plans/[id]` | 方案详情 / 迭代与公开切换 / 删除（公开方案他人可读） |
| GET/POST | `/api/comments` | 评论列表 / 发布（公开方案开放，私有方案仅作者） |

SSE 事件协议见 [docs/04-AI技术方案.md](docs/04-AI技术方案.md) 与 `src/lib/agent/types.ts`。

---

## 🗂️ 项目结构

```
.
├── prisma/
│   ├── schema.prisma            # User / ProjectPlan / Comment / AiAuditLog
│   └── seed.mjs                 # 演示用户 / 公开项目 / 评论初始化
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/generate   # Agent SSE 接口
│   │   │   ├── agent/audit      # 调用审计
│   │   │   ├── knowledge/       # 知识库检索
│   │   │   ├── health/          # 健康检查
│   │   │   ├── chat/ plans/ comments/ auth/
│   │   ├── login/ home/ tool/ business/ profile/ plans/[id]/ users/[id]/   # 页面
│   │   ├── error.tsx / loading.tsx
│   ├── components/
│   │   ├── plan-workspace.tsx   # 工作台（输入 + Agent 输出）
│   │   ├── agent-timeline.tsx   # 工作流时间线
│   │   ├── source-list.tsx      # 解析结果 / 工具轨迹 / 检索依据
│   │   ├── quality-report.tsx   # 质检报告
│   │   ├── plan-diagram.tsx     # Mermaid 架构图
│   │   ├── knowledge-panel.tsx  # 知识库检索
│   │   ├── audit-panel.tsx      # AI 审计
│   │   └── ui/                  # shadcn/ui 基础组件
│   ├── lib/
│   │   ├── agent/               # 编排器 / 提示词 / 工具 / 类型
│   │   ├── rag/                 # 语料 / 切块 / 混合检索
│   │   ├── safety.ts            # 安全与内容审核
│   │   ├── audit.ts             # 审计写入
│   │   ├── validation.ts        # Zod 校验
│   │   ├── ai.ts / auth.ts / db.ts / rate-limit.ts
│   └── middleware.ts
├── docs/                        # 技术文档与评审对标
├── Dockerfile
├── docker-compose.yml
└── .env.example / .env.docker.example
```

---

## 🧪 验证

```bash
# 类型检查与构建
pnpm exec tsc --noEmit
pnpm build

# 健康检查
curl http://localhost:3000/api/health

# 知识库检索
curl -b cookie.txt -H 'Content-Type: application/json' \
  -d '{"query":"小团队如何做 RAG 与排期","topK":4}' \
  http://localhost:3000/api/knowledge
```

功能验收路径：

1. 注册登录，进入 `/tool` 或 `/business`；
2. 点击「填入示例」→「创新合成」，观察五阶段时间线；
3. 切换「依据 / 质检 / 架构图 / 知识库」标签查看中间产物；
4. 生成完成后自动保存，个人主页可查看历史方案与「AI 审计」；
5. 在个人主页切换项目「公开 / 私有」，公开后可在首页「社区精选」与他人公开主页看到；
6. 进入公开项目评论区，发表项目分享或技术提问，点击评论者头像验证公开主页跳转；
7. 提交含注入指令的输入，验证安全拦截。

---

## 📚 文档

- [01 项目概述](docs/01-项目概述.md)
- [02 需求分析](docs/02-需求分析.md)
- [03 系统架构设计](docs/03-系统架构设计.md)
- [04 AI 技术方案](docs/04-AI技术方案.md)
- [05 核心功能实现](docs/05-核心功能实现.md)
- [06 测试与部署](docs/06-测试与部署.md)
- [07 创新点说明](docs/07-创新点说明.md)
- [08 总结与展望](docs/08-总结与展望.md)
- [09 免费部署上线一个月方案](docs/09-免费部署上线一个月方案.md)
- [10 评审标准对标说明](docs/10-评审对标说明.md)

---

## 👥 团队信息

| 角色 | 姓名 |
| --- | --- |
| 队长 / 全栈开发 | yzhldp |
| 前端开发 | 待补充 |
| 后端开发 | 待补充 |
| 产品 / 设计 | 待补充 |

> 仓库地址：<https://github.com/yzhldp/ai-web>（Public，可直接评审访问）。

---

## 📄 开源协议

本项目为传智杯 AI Web 参赛作品，仅供学习交流使用。
