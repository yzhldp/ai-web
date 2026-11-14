/**
 * 演示数据初始化脚本
 * 创建几位演示用户、公开/私有项目与评论区交流内容，便于直接体验
 * 社区与公开主页功能。脚本可重复执行，不会覆盖已有数据。
 *
 * 运行方式：node prisma/seed.mjs（Docker 启动时自动执行）
 * 演示账号密码统一为：demo1234
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";

const USERS = [
  { id: "demo-user-linxiaoman", username: "linxiaoman", nickname: "林小满" },
  { id: "demo-user-chenyiming", username: "chenyiming", nickname: "陈一鸣" },
  { id: "demo-user-suqing", username: "suqing", nickname: "苏晴" },
  { id: "demo-user-zhouye", username: "zhouye", nickname: "周野" },
];

const PLANS = [
  {
    id: "demo-plan-inspiration",
    userId: "demo-user-linxiaoman",
    mode: "tool",
    visibility: "public",
    painPoint:
      "脑子里每天冒出很多零散想法，记在备忘录里就再也没打开过，很难判断哪个值得做。",
    demand:
      "希望有一个工具能把碎片想法自动归类、补全，并给出可执行的第一步，而不是只做简单记录。",
    idea:
      "像「灵感卡片」一样，输入一句话就生成项目雏形卡片，支持公开分享给社区伙伴一起讨论。",
    content: `# 灵感卡片 · 碎片想法聚合器

## 一、项目定位

面向独立开发者和学生创客的「碎片想法 → 可执行雏形」工具。用户只需输入一句零散灵感，系统自动补齐目标用户、核心功能、技术方案与第一步行动清单。

## 二、目标用户

- 经常记录想法但缺少落地方法的独立开发者；
- 参加黑客松、创新创业比赛的学生团队；
- 需要快速验证方向的产品经理。

## 三、核心功能

1. **灵感速记**：一句话输入，自动提取关键词与场景；
2. **雏形补全**：基于领域知识库补全功能模块、技术选型与风险点；
3. **行动清单**：拆出 3 天内可完成的第一步；
4. **公开分享**：将成熟想法设为公开，接受社区评论与技术提问。

## 四、技术方案

- 前端：Next.js 14 App Router + Tailwind CSS；
- 后端：Route Handlers + Prisma + SQLite；
- AI：多供应商路由（DeepSeek 为主，失败自动切换），配合 RAG 检索增强；
- 检索：中文二元分词 + BM25 与稀疏向量混合召回。

## 五、迭代计划

- 第 1 周：完成输入与卡片生成闭环；
- 第 2 周：接入公开主页与评论区；
- 第 3 周：补充行动清单与导出能力。`,
  },
  {
    id: "demo-plan-textbook",
    userId: "demo-user-chenyiming",
    mode: "tool",
    visibility: "public",
    painPoint:
      "毕业季二手书交易价格全靠感觉，卖家怕卖亏、买家怕买贵，沟通成本很高。",
    demand:
      "希望根据书籍品相、专业、供需情况给出一个双方都能接受的参考价。",
    idea:
      "做一个校园二手书智能定价助手，拍照识别品相，结合同校历史成交价给出报价区间。",
    content: `# 校园二手书智能定价助手

## 项目简介

面向高校毕业季的二手书交易定价工具。通过「品相选择 + 图片辅助识别 + 同校历史成交价」三层信息，给出合理的价格区间，降低买卖双方沟通成本。

## 核心功能

- 扫码 / 搜索录入书名与版次；
- 品相分级：全新、少量笔记、划线较多、缺页；
- 图片辅助识别书页磨损与笔记密度；
- 输出建议报价区间与成交概率。

## 技术要点

- 视觉模型负责品相辅助判断；
- 规则引擎叠加专业热度、供需比与时间衰减；
- 所有定价依据可解释，避免「黑箱报价」。

## 冷启动策略

先聚合校内二手群的历史成交截图，人工标注 200 条作为种子数据，再逐步替换为真实成交记录。`,
  },
  {
    id: "demo-plan-kitchen",
    userId: "demo-user-suqing",
    mode: "business",
    visibility: "public",
    painPoint:
      "社区里很多独居年轻人想自己做饭，但厨房设备不全、买菜份量难控制，外卖成本又高。",
    demand:
      "希望有一个共享厨房空间，按次预约，提供基础厨具与食材包，还能顺便认识邻居。",
    idea:
      "社区共享厨房 + 食材包订阅 + 周末料理社交活动，按次收费并推出月度会员。",
    content: `# 社区共享厨房创业计划

## 一、机会洞察

独居青年「想做饭但缺设备、缺搭子、怕浪费」的需求长期存在，而社区闲置商业空间成本相对可控。

## 二、产品形态

- **共享厨房**：按小时预约，配置基础灶具、烤箱与清洗区；
- **食材包**：与周边生鲜店合作，按菜谱提供小份净菜；
- **料理社交**：周末主题料理课与邻里拼餐活动。

## 三、收入模型

1. 厨房按时段收费；
2. 食材包与厨具租赁分成；
3. 月度会员（含固定时段与活动优先报名）；
4. 品牌合作与料理课程。

## 四、合规与风险

- 明确食品安全责任与清洁消毒流程；
- 购买公众责任险；
- 与社区物业签订场地协议，避免扰民投诉；
- 建立预约信用分，减少爽约。`,
  },
  {
    id: "demo-plan-lab",
    userId: "demo-user-zhouye",
    mode: "tool",
    visibility: "public",
    painPoint:
      "实验室设备预约靠群里接龙，巡检靠纸质表格，经常出现时间冲突和漏检。",
    demand:
      "希望有统一的预约与巡检系统，能实时看到设备状态，异常自动提醒负责人。",
    idea:
      "设备二维码 + 预约日历 + 巡检任务 + 异常上报，做成轻量化的实验室设备管理工具。",
    content: `# 实验室设备预约与巡检系统

## 背景

高校实验室设备种类多、使用频率高，传统群接龙预约与纸质巡检存在冲突、漏检和追溯困难等问题。

## 功能设计

- 设备二维码：扫码查看状态、预约与报修；
- 预约日历：按时间段锁定，冲突自动拦截；
- 巡检任务：按周期自动生成，支持拍照留痕；
- 异常上报：超时未处理自动升级提醒负责人。

## 技术实现

- 前端：响应式 Web，移动端扫码即用；
- 后端：定时任务生成巡检计划，消息队列处理提醒；
- 权限：学生 / 管理员 / 设备负责人三级角色。

## 落地路径

先在单个实验室试点，跑通预约与巡检闭环后，再推广到学院其他实验室。`,
  },
  {
    id: "demo-plan-private-notes",
    userId: "demo-user-linxiaoman",
    mode: "business",
    visibility: "private",
    painPoint: "个人知识库整理成本高，付费社群运营缺少系统化工具。",
    demand: "希望有一套私域知识付费社群的运营方案。",
    idea: "先做小范围内测，暂不公开。",
    content: `# 个人知识库付费社群（筹备中）

这是一个尚未公开的筹备方案，仅作者本人可见。

- 目标：把个人知识库沉淀为可订阅的内容产品；
- 模式：年度订阅 + 每月直播答疑；
- 状态：需求验证阶段，暂不对外公开。`,
  },
];

const COMMENTS = [
  {
    id: "demo-comment-1",
    planId: "demo-plan-inspiration",
    userId: "demo-user-chenyiming",
    content:
      "分享一个我在做的项目：校园二手书智能定价助手，用视觉模型辅助判断品相。看到你方案里的多供应商自动故障转移很感兴趣，想请教一下，是只在首 Token 之前切换，还是生成过程中也会切换？",
    createdAt: "2026-11-11T10:12:00+08:00",
  },
  {
    id: "demo-comment-2",
    planId: "demo-plan-inspiration",
    userId: "demo-user-linxiaoman",
    content:
      "@陈一鸣 首 Token 之前失败会无缝切换下一家；一旦已经开始输出就不再切换，避免内容重复。非流式调用则遇到超时、报错或非法 JSON 都会自动换供应商。二手书项目如果需要图片理解，建议优先选支持视觉的供应商。",
    createdAt: "2026-11-11T10:26:00+08:00",
  },
  {
    id: "demo-comment-3",
    planId: "demo-plan-inspiration",
    userId: "demo-user-suqing",
    content:
      "技术提问：RAG 为什么选择 BM25 + 稀疏向量，而不是直接上向量数据库？团队规模不大时维护成本会不会更高？",
    createdAt: "2026-11-11T14:05:00+08:00",
  },
  {
    id: "demo-comment-4",
    planId: "demo-plan-inspiration",
    userId: "demo-user-linxiaoman",
    content:
      "@苏晴 主要是部署成本考虑。中文二元分词 + 2048 维稀疏向量可以完全跑在 SQLite 这一层，Docker 单机就能启动，不用额外维护向量库；评测里 Recall@6 足够支撑方案生成。数据量再大时可以平滑替换成 pgvector。",
    createdAt: "2026-11-11T14:31:00+08:00",
  },
  {
    id: "demo-comment-5",
    planId: "demo-plan-inspiration",
    userId: "demo-user-zhouye",
    content:
      "分享我的实验室设备预约与巡检系统，也用了类似的「任务拆解 + 异常升级」思路。你这个五阶段 Agent 的时间线可视化很有参考价值，准备抄作业做一个巡检流程版本。",
    createdAt: "2026-11-12T09:18:00+08:00",
  },
  {
    id: "demo-comment-6",
    planId: "demo-plan-textbook",
    userId: "demo-user-suqing",
    content:
      "二手书定价最难的是品相标准化，每个人对「少量笔记」的理解都不一样。你准备怎么让买卖双方对品相有一致的预期？",
    createdAt: "2026-11-12T11:02:00+08:00",
  },
  {
    id: "demo-comment-7",
    planId: "demo-plan-textbook",
    userId: "demo-user-chenyiming",
    content:
      "@苏晴 目前的思路是固定 4 档品相 + 每档配示例图，再用图片识别笔记密度做辅助校准；如果图片和用户选择差异较大，会提示重新确认，尽量避免争议。",
    createdAt: "2026-11-12T11:20:00+08:00",
  },
  {
    id: "demo-comment-8",
    planId: "demo-plan-textbook",
    userId: "demo-user-linxiaoman",
    content:
      "建议再加一个「同校近 30 天成交价」维度，专业热门程度对价格影响很大。我们学校计算机类教材毕业季基本不打折，冷门专业课反而要降价才能出。",
    createdAt: "2026-11-12T13:40:00+08:00",
  },
  {
    id: "demo-comment-9",
    planId: "demo-plan-kitchen",
    userId: "demo-user-zhouye",
    content:
      "共享厨房的食品安全责任怎么划分？如果用户自己带食材、自己烹饪，场地方还需要承担哪些责任？方案里的合规部分写得很细，想听听你的落地考虑。",
    createdAt: "2026-11-13T09:05:00+08:00",
  },
  {
    id: "demo-comment-10",
    planId: "demo-plan-kitchen",
    userId: "demo-user-suqing",
    content:
      "@周野 我们计划把「场地提供」和「食材供应」分开：自带食材只收场地费，签署操作规范告知书；食材包由合作方提供并承担相应责任。同时购买公众责任险，清洁消毒流程上墙留痕。",
    createdAt: "2026-11-13T09:34:00+08:00",
  },
  {
    id: "demo-comment-11",
    planId: "demo-plan-lab",
    userId: "demo-user-chenyiming",
    content:
      "设备巡检的异常上报准备用 WebSocket 还是轮询？实验室网络有时候不稳定，实时性要求不高的话轮询可能更省心。",
    createdAt: "2026-11-13T15:22:00+08:00",
  },
  {
    id: "demo-comment-12",
    planId: "demo-plan-lab",
    userId: "demo-user-zhouye",
    content:
      "@陈一鸣 预约冲突用轮询就够了，异常上报准备走 WebSocket + 失败重连，超时未处理再落库补偿。网络不稳定时降级为定时拉取，保证消息最终可达。",
    createdAt: "2026-11-13T15:48:00+08:00",
  },
];

async function ensureUser(data, hashedPassword) {
  const exists = await prisma.user.findUnique({ where: { id: data.id } });
  if (exists) return false;
  await prisma.user.create({
    data: { ...data, password: hashedPassword },
  });
  return true;
}

async function ensurePlan(data) {
  const exists = await prisma.projectPlan.findUnique({ where: { id: data.id } });
  if (exists) return false;
  await prisma.projectPlan.create({ data });
  return true;
}

async function ensureComment(data) {
  const exists = await prisma.comment.findUnique({ where: { id: data.id } });
  if (exists) return false;
  await prisma.comment.create({
    data: {
      ...data,
      createdAt: new Date(data.createdAt),
    },
  });
  return true;
}

async function main() {
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  let userCount = 0;
  for (const user of USERS) {
    if (await ensureUser(user, hashedPassword)) userCount += 1;
  }

  let planCount = 0;
  for (const plan of PLANS) {
    if (await ensurePlan({ ...plan, hasImage: false })) planCount += 1;
  }

  let commentCount = 0;
  for (const comment of COMMENTS) {
    if (await ensureComment(comment)) commentCount += 1;
  }

  console.log(
    `[seed] 演示数据就绪：新增用户 ${userCount}，公开/私有项目 ${planCount}，评论 ${commentCount}`
  );
}

main()
  .catch((error) => {
    console.error("[seed] 演示数据初始化失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
