/**
 * 轻量混合检索（Hybrid RAG）
 *
 * 两路召回：
 * 1) BM25 关键词检索：对中文采用字符二元组（bigram）切分，适合专有名词精确命中；
 * 2) 稀疏向量检索：哈希 + TF-IDF 向量化后计算余弦相似度，捕捉词频层面语义。
 *
 * 无需外部向量数据库或 Embedding API，随进程内构建索引，Docker 单机即可运行。
 * 两路得分加权融合：score = 0.6 * cosine + 0.4 * bm25_norm。
 */

import { knowledgeDocs, type KnowledgeDoc } from "./corpus";

export interface KnowledgeChunk {
  id: string;
  docId: string;
  docTitle: string;
  category: string;
  tags: string[];
  heading: string;
  content: string;
  tokens: string[];
  length: number;
}

export interface RetrievedChunk {
  id: string;
  docId: string;
  docTitle: string;
  category: string;
  heading: string;
  content: string;
  /** 融合得分（0~1） */
  score: number;
  /** 语义（稀疏向量）得分 */
  cosine: number;
  /** 关键词 BM25 得分（归一化后） */
  bm25: number;
  /** 命中的关键词 */
  matched: string[];
}

/** 常见中文停用词，避免「的/了/和」等虚词污染检索 */
const STOP_WORDS = new Set([
  "的",
  "了",
  "和",
  "与",
  "及",
  "或",
  "是",
  "在",
  "对",
  "把",
  "被",
  "为",
  "我",
  "你",
  "他",
  "它",
  "这",
  "那",
  "一个",
  "我们",
  "你们",
  "他们",
  "可以",
  "需要",
  "进行",
  "通过",
  "以及",
  "the",
  "and",
  "for",
  "with",
]);

/** 领域同义词扩展：提升口语化输入对专业文档的召回率 */
const SYNONYMS: Record<string, string[]> = {
  电商: ["商城", "购物", "交易", "店铺", "零售"],
  教育: ["学习", "课程", "教学", "培训", "校园"],
  医疗: ["健康", "问诊", "病历", "医院", "康复"],
  办公: ["协作", "文档", "企业", "效率", "会议"],
  社交: ["社区", "内容", "关系", "互动"],
  排期: ["工期", "里程碑", "计划", "进度", "开发周期"],
  商业模式: ["变现", "盈利", "营收", "收费", "定价"],
  风险: ["合规", "隐私", "安全", "难点", "隐患"],
  技术选型: ["框架", "数据库", "架构", "技术栈", "中间件"],
  用户: ["人群", "客户", "目标用户", "受众"],
  增长: ["获客", "拉新", "留存", "转化", "推广"],
  多模态: ["图片", "语音", "视频", "视觉", "图像"],
  检索: ["rag", "知识库", "向量", "召回"],
  工具调用: ["function calling", "mcp", "agent", "智能体"],
  性能: ["优化", "首屏", "加载", "响应速度"],
  成本: ["token", "费用", "预算", "额度"],
};

/** 稀疏向量维度，2048 维在内存与区分度之间较均衡 */
const VECTOR_DIM = 2048;

/** 提取中文二元组 + 英文/数字词元 */
export function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const tokens: string[] = [];

  const latin = normalized.match(/[a-z0-9][a-z0-9.+#-]*/g) ?? [];
  for (const word of latin) {
    if (word.length >= 2 && !STOP_WORDS.has(word)) tokens.push(word);
  }

  const cjkRuns = normalized.match(/[\u4e00-\u9fa5]+/g) ?? [];
  for (const run of cjkRuns) {
    if (run.length === 1) {
      if (!STOP_WORDS.has(run)) tokens.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) {
      const bigram = run.slice(i, i + 2);
      if (!STOP_WORDS.has(bigram)) tokens.push(bigram);
    }
  }

  return tokens;
}

/** 查询扩展：把命中词的同义术语加入检索词 */
function expandQueryTokens(query: string): string[] {
  const base = tokenize(query);
  const extra: string[] = [];
  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (query.includes(key) || base.includes(key)) {
      for (const value of values) extra.push(...tokenize(value));
    }
  }
  return Array.from(new Set([...base, ...extra]));
}

/** 简单字符串哈希（FNV-1a），保证同一词元落到同一维度 */
function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % VECTOR_DIM;
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
  return tf;
}

/** 按 Markdown 二级标题切块；过长内容再按段落二次切分，保留少量重叠 */
function chunkDocument(doc: KnowledgeDoc): KnowledgeChunk[] {
  const sections: { heading: string; body: string }[] = [];
  const parts = doc.content.split(/^##\s+/m);

  const intro = parts.shift()?.trim();
  if (intro) sections.push({ heading: "概述", body: intro });

  for (const part of parts) {
    const newlineIndex = part.indexOf("\n");
    const heading = newlineIndex === -1 ? part.trim() : part.slice(0, newlineIndex).trim();
    const body = newlineIndex === -1 ? "" : part.slice(newlineIndex + 1).trim();
    if (body) sections.push({ heading, body });
  }

  const chunks: KnowledgeChunk[] = [];
  sections.forEach((section, sectionIndex) => {
    const paragraphs = section.body.split(/\n{2,}/).filter(Boolean);
    const groups: string[] = [];
    let current = "";
    for (const paragraph of paragraphs) {
      if (current.length + paragraph.length > 520 && current) {
        groups.push(current.trim());
        // 重叠 60 字，避免切断上下文语义
        current = current.slice(-60) + "\n\n" + paragraph;
      } else {
        current = current ? `${current}\n\n${paragraph}` : paragraph;
      }
    }
    if (current.trim()) groups.push(current.trim());

    groups.forEach((bodyText, groupIndex) => {
      const text = `${doc.title} ${section.heading} ${bodyText}`;
      chunks.push({
        id: `${doc.id}#${sectionIndex}-${groupIndex}`,
        docId: doc.id,
        docTitle: doc.title,
        category: doc.category,
        tags: doc.tags,
        heading: section.heading,
        content: bodyText,
        tokens: tokenize(text),
        length: tokenize(bodyText).length,
      });
    });
  });

  return chunks;
}

interface RagIndex {
  chunks: KnowledgeChunk[];
  df: Map<string, number>;
  avgLength: number;
  vectors: Map<string, Float32Array>;
  /** 向量范数，预先计算加速余弦相似度 */
  norms: Map<string, number>;
}

let indexCache: RagIndex | null = null;

function buildIndex(): RagIndex {
  const chunks = knowledgeDocs.flatMap(chunkDocument);
  const df = new Map<string, number>();

  for (const chunk of chunks) {
    for (const token of new Set(chunk.tokens)) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const avgLength = chunks.length ? totalLength / chunks.length : 0;

  const vectors = new Map<string, Float32Array>();
  const norms = new Map<string, number>();

  for (const chunk of chunks) {
    const vector = new Float32Array(VECTOR_DIM);
    const tf = termFrequency(chunk.tokens);
    for (const [token, count] of tf) {
      const idf = Math.log((chunks.length + 1) / ((df.get(token) ?? 0) + 1)) + 1;
      const weight = (1 + Math.log(count)) * idf;
      vector[hashToken(token)] += weight;
    }
    let norm = 0;
    for (let i = 0; i < VECTOR_DIM; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < VECTOR_DIM; i++) vector[i] /= norm;
    vectors.set(chunk.id, vector);
    norms.set(chunk.id, norm);
  }

  return { chunks, df, avgLength, vectors, norms };
}

function getIndex(): RagIndex {
  if (!indexCache) indexCache = buildIndex();
  return indexCache;
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;

/**
 * 混合检索
 * @param query 自然语言查询
 * @param topK 返回条数
 * @param category 可选分类过滤
 */
export function searchKnowledge(
  query: string,
  options: { topK?: number; category?: string } = {}
): RetrievedChunk[] {
  const { topK = 6, category } = options;
  const index = getIndex();
  const queryTokens = expandQueryTokens(query);
  if (!queryTokens.length) return [];

  // 查询向量
  const queryVector = new Float32Array(VECTOR_DIM);
  const queryTf = termFrequency(queryTokens);
  for (const [token, count] of queryTf) {
    const idf = Math.log((index.chunks.length + 1) / ((index.df.get(token) ?? 0) + 1)) + 1;
    queryVector[hashToken(token)] += (1 + Math.log(count)) * idf;
  }
  let queryNorm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) queryNorm += queryVector[i] * queryVector[i];
  queryNorm = Math.sqrt(queryNorm) || 1;

  const querySet = new Set(queryTokens);
  const scored = index.chunks
    .filter((chunk) => !category || chunk.category === category)
    .map((chunk) => {
      const tf = termFrequency(chunk.tokens);

      // BM25
      let bm25 = 0;
      for (const token of querySet) {
        const freq = tf.get(token);
        if (!freq) continue;
        const df = index.df.get(token) ?? 0;
        const idf = Math.log(1 + (index.chunks.length - df + 0.5) / (df + 0.5));
        const denominator =
          freq + BM25_K1 * (1 - BM25_B + (BM25_B * chunk.length) / (index.avgLength || 1));
        bm25 += idf * ((freq * (BM25_K1 + 1)) / denominator);
      }

      // 余弦相似度（稀疏向量）
      const vector = index.vectors.get(chunk.id)!;
      let dot = 0;
      for (let i = 0; i < VECTOR_DIM; i++) {
        if (queryVector[i] && vector[i]) dot += queryVector[i] * vector[i];
      }
      const cosine = dot / queryNorm;

      const matched = Array.from(querySet).filter((token) => tf.has(token)).slice(0, 6);

      return { chunk, bm25, cosine, matched };
    })
    .filter((item) => item.bm25 > 0 || item.cosine > 0.01);

  if (!scored.length) return [];

  const maxBm25 = Math.max(...scored.map((item) => item.bm25), 0.0001);

  return scored
    .map((item) => ({
      id: item.chunk.id,
      docId: item.chunk.docId,
      docTitle: item.chunk.docTitle,
      category: item.chunk.category,
      heading: item.chunk.heading,
      content: item.chunk.content,
      score: Number((0.6 * item.cosine + 0.4 * (item.bm25 / maxBm25)).toFixed(4)),
      cosine: Number(item.cosine.toFixed(4)),
      bm25: Number(item.bm25.toFixed(4)),
      matched: item.matched,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** 知识库元信息，用于前端展示与健康检查 */
export function getKnowledgeStats() {
  const index = getIndex();
  const categories = Array.from(new Set(knowledgeDocs.map((doc) => doc.category)));
  return {
    documents: knowledgeDocs.length,
    chunks: index.chunks.length,
    categories,
    dimensions: VECTOR_DIM,
    docs: knowledgeDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      tags: doc.tags,
      chunks: index.chunks.filter((chunk) => chunk.docId === doc.id).length,
    })),
  };
}
