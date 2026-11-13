import { z } from "zod";

/** Agent 生成请求 */
export const agentRequestSchema = z.object({
  mode: z.enum(["tool", "business"]),
  painPoint: z.string().max(4000, "痛点描述不能超过 4000 字").default(""),
  demand: z.string().max(4000, "需求描述不能超过 4000 字").default(""),
  idea: z.string().max(4000, "奇思妙想不能超过 4000 字").default(""),
  deep: z.boolean().default(true),
  /** 前端压缩后的图片 Data URL，限制 6MB 以内 */
  image: z
    .string()
    .max(6_000_000, "参考图过大，请压缩后重试")
    .refine((value) => value.startsWith("data:image/"), "参考图格式不正确")
    .nullable()
    .optional(),
});

export type AgentRequest = z.infer<typeof agentRequestSchema>;

/** 知识库检索请求 */
export const knowledgeQuerySchema = z.object({
  query: z.string().min(1, "请输入检索内容").max(500),
  topK: z.number().min(1).max(10).default(6),
  category: z.string().max(50).optional(),
});

/** 方案保存请求 */
export const planCreateSchema = z.object({
  mode: z.enum(["tool", "business"]),
  painPoint: z.string().max(4000).default(""),
  demand: z.string().max(4000).default(""),
  idea: z.string().max(4000).default(""),
  content: z.string().min(1, "方案内容不能为空").max(60000),
  analysis: z.string().max(20000).optional(),
  sources: z.string().max(30000).optional(),
  quality: z.string().max(10000).optional(),
  diagram: z.string().max(8000).optional(),
  hasImage: z.boolean().optional(),
});

/** 统一提取 Zod 错误信息 */
export function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "请求参数不合法";
}
