/**
 * 站内助手本地知识库
 *
 * 不依赖大模型即可回答项目常见问题、执行页面跳转；
 * 只有未命中本地意图时才请求 AI，未接入 AI 时自动降级到离线提示。
 */

export interface LocalIntentResult {
  reply: string;
  path?: string;
}

interface FaqEntry {
  keywords: string[];
  answer: string;
}

interface NavEntry {
  keywords: string[];
  path: string;
  label: string;
}

const FAQS: FaqEntry[] = [
  {
    keywords: ["怎么用", "怎么使用", "如何使用", "使用步骤", "上手", "怎么开始"],
    answer:
      "三步开始：\n1. 进入「工具创新」或「创业创新」\n2. 填写痛点 / 需求，或点「填入示例」\n3. 点击「创新合成」，等待五阶段完成。",
  },
  {
    keywords: ["功能", "能做什么", "可以做什么", "介绍", "是什么"],
    answer:
      "我可以帮你：\n· 五阶段生成项目方案\n· 知识库检索与引用\n· 技术选型 / 排期 / 风险工具\n· 方案质检与架构图\n· 方案迭代、保存与导出。",
  },
  {
    keywords: ["区别", "不同", "对比", "工具创新和创业"],
    answer:
      "工具创新偏软件产品：功能、技术栈、模块与排期。\n创业创新偏商业项目：目标用户、商业模式、成本收益与市场风险。",
  },
  {
    keywords: [
      "没接ai能做什么",
      "没接ai",
      "没有ai",
      "离线",
      "没配置",
      "没有密钥",
      "密钥",
      "未接入",
    ],
    answer:
      "没接 AI 也能用：\n· 我可以回答项目使用问题\n· 可以帮你跳转页面\n· 方案生成需要配置 DEEPSEEK_API_KEY / DASHSCOPE_API_KEY 等密钥。",
  },
  {
    keywords: ["安全", "隐私", "数据", "泄露", "权限"],
    answer:
      "方案与评论仅本人可见；手机号 / 邮箱 / 身份证会脱敏；AI 调用记录只保留摘要并写入审计日志。",
  },
  {
    keywords: ["rag", "知识库", "检索", "引用", "依据", "来源"],
    answer:
      "知识库采用 BM25 + 稀疏向量混合检索；生成内容用 [编号] 标注依据；知识库页可运行 Recall@6 / HitRate / MRR 评测。",
  },
  {
    keywords: ["质检", "评分", "质量", "分数"],
    answer:
      "深度模式会从需求覆盖度、技术可行性、落地可执行性、创新性、风险完整性五个维度评分，并给出改进建议与架构图。",
  },
  {
    keywords: ["迭代", "补充需求", "修改方案", "优化方案"],
    answer:
      "生成方案后，在下方输入补充需求并发送；系统会重新执行完整 Agent 工作流，并同步刷新依据、质检和架构图。",
  },
  {
    keywords: ["保存", "导出", "下载", "pdf", "word", "markdown"],
    answer:
      "方案会自动保存到个人主页；详情页支持导出 Markdown，也可以用「打印 / PDF」另存为 PDF。",
  },
  {
    keywords: ["模型", "供应商", "切换", "deepseek", "qwen", "通义", "openai", "故障"],
    answer:
      "支持 DeepSeek、通义千问、Moonshot、OpenAI、Ollama；主供应商失败会自动切换，并在工作台显示切换次数。",
  },
  {
    keywords: ["架构图", "mermaid", "流程图"],
    answer: "生成方案后会输出 Mermaid 架构图，可缩放查看并导出 SVG。",
  },
  {
    keywords: ["收费", "价格", "多少钱", "免费"],
    answer: "当前为参赛演示版本，功能免费使用；实际部署成本主要来自模型 Token 与服务器资源。",
  },
  {
    keywords: ["评论", "交流"],
    answer: "方案详情页支持评论；当前方案与评论仅作者本人可见。",
  },
];

const NAVS: NavEntry[] = [
  {
    keywords: ["工具创新", "工具页", "/tool"],
    path: "/tool",
    label: "工具创新工作台",
  },
  {
    keywords: ["创业创新", "商业创新", "商业页", "/business"],
    path: "/business",
    label: "创业创新工作台",
  },
  {
    keywords: ["个人主页", "我的主页", "我的方案", "历史方案", "/profile"],
    path: "/profile",
    label: "个人主页",
  },
  {
    keywords: ["首页", "主页", "/home"],
    path: "/home",
    label: "首页",
  },
  {
    keywords: ["知识库", "检索评测"],
    path: "/tool",
    label: "工具创新工作台（知识库标签）",
  },
];

export const QUICK_QUESTIONS = [
  "怎么使用这个项目？",
  "工具创新和创业创新有什么区别？",
  "没接 AI 能做什么？",
  "跳转到个人主页",
];

export const OFFLINE_FALLBACK =
  "我现在处于离线问答模式，但还能帮你：\n· 介绍项目功能与使用步骤\n· 说明知识库、质检、导出能力\n· 跳转到工具创新 / 创业创新 / 个人主页\n配置模型密钥后，我就能生成完整方案。";

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[\s，。！？、,.!?：:；;"'“”‘’()（）【】[\]<>]/g, "");
}

function score(text: string, keywords: string[]) {
  // 使用命中关键词长度之和，避免「能做什么」这类泛词压过更具体的问题
  return keywords.reduce(
    (total, keyword) =>
      text.includes(normalize(keyword)) ? total + normalize(keyword).length : total,
    0
  );
}

/** 本地意图识别：导航优先，其次 FAQ；未命中返回 null */
export function matchLocalIntent(raw: string): LocalIntentResult | null {
  const text = normalize(raw);
  if (!text) return null;

  const action = /(跳转|打开|进入|带我去|切换到|查看|去)/.test(text);

  for (const nav of NAVS) {
    const hits = score(text, nav.keywords);
    const exact = nav.keywords.some((keyword) => text === normalize(keyword));
    if (hits > 0 && (action || exact)) {
      return {
        reply: `已为你打开「${nav.label}」。${nav.path === "/tool" ? "需要查看检索评测时，点击页面上方「知识库」标签即可。" : ""}`,
        path: nav.path,
      };
    }
  }

  const ranked = FAQS.map((entry) => ({
    entry,
    hits: score(text, entry.keywords),
  }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (ranked.length > 0) {
    return { reply: ranked[0].entry.answer };
  }

  return null;
}
