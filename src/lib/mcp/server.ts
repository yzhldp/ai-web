/**
 * 轻量 MCP Server（HTTP JSON-RPC 2.0）
 *
 * 对标准 MCP 的核心方法做最小实现：
 * - initialize
 * - tools/list
 * - tools/call
 * - ping
 *
 * 工具实现直接复用 Agent 的确定性工具层，保证「MCP 对外能力」
 * 与「内部 Function Calling」使用同一套逻辑，避免两套实现漂移。
 */
import { z } from "zod";
import { searchKnowledge } from "@/lib/rag";
import {
  estimateSchedule,
  recommendTechStack,
  riskChecklist,
  summarizeRisks,
  summarizeSchedule,
  summarizeTech,
} from "@/lib/agent/tools";

/** MCP 协议版本（与主流客户端兼容） */
export const MCP_PROTOCOL_VERSION = "2024-11-05";

/** 服务标识 */
export const MCP_SERVER_INFO = {
  name: "creative-prototype-assistant",
  version: "1.0.0",
} as const;

type JsonRpcId = string | number | null;

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** 执行工具；参数校验失败会抛出 ZodError */
  run: (rawArgs: unknown) => Promise<string>;
}

export interface McpResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const knowledgeArgs = z.object({
  query: z.string().min(1, "query 不能为空"),
  topK: z.number().int().min(1).max(8).optional(),
});

const techArgs = z.object({
  scenario: z.string().min(1, "scenario 不能为空"),
  teamSize: z.number().int().min(1).max(50).optional(),
  priority: z.string().optional(),
});

const scheduleArgs = z.object({
  moduleCount: z.number().int().min(1).max(30),
  teamSize: z.number().int().min(1).max(50).optional(),
  complexity: z.enum(["low", "medium", "high"]).optional(),
});

const riskArgs = z.object({
  mode: z.enum(["tool", "business"]),
  domain: z.string().optional(),
});

/** MCP 工具定义（inputSchema 使用 JSON Schema，供客户端自动发现） */
const MCP_TOOLS: McpTool[] = [
  {
    name: "search_knowledge_base",
    description:
      "检索内置项目规划知识库（技术选型、AI 架构、商业模式、MVP、排期、合规、行业案例）。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "检索查询，建议使用具体中文关键词" },
        topK: {
          type: "integer",
          minimum: 1,
          maximum: 8,
          description: "返回条数，默认 4",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    run: async (rawArgs) => {
      const args = knowledgeArgs.parse(rawArgs);
      const results = searchKnowledge(args.query, { topK: args.topK ?? 4 });
      return JSON.stringify(
        results.map((item, index) => ({
          index: index + 1,
          title: `${item.docTitle} · ${item.heading}`,
          content: item.content.slice(0, 320),
          score: item.score,
        })),
        null,
        2
      );
    },
  },
  {
    name: "recommend_tech_stack",
    description:
      "根据项目场景、团队规模与优先级，给出前端、后端、数据库、AI 与部署的技术选型建议。",
    inputSchema: {
      type: "object",
      properties: {
        scenario: { type: "string", description: "项目场景描述" },
        teamSize: { type: "integer", minimum: 1, maximum: 50 },
        priority: { type: "string", description: "例如：快速交付 / 成本优先" },
      },
      required: ["scenario"],
      additionalProperties: false,
    },
    run: async (rawArgs) => {
      const args = techArgs.parse(rawArgs);
      const rec = recommendTechStack(args);
      return `${summarizeTech(rec)}\n\n${JSON.stringify(rec, null, 2)}`;
    },
  },
  {
    name: "estimate_schedule",
    description:
      "根据模块数量、团队规模与复杂度估算开发排期，输出阶段、周数与交付物。",
    inputSchema: {
      type: "object",
      properties: {
        moduleCount: { type: "integer", minimum: 1, maximum: 30 },
        teamSize: { type: "integer", minimum: 1, maximum: 50 },
        complexity: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["moduleCount"],
      additionalProperties: false,
    },
    run: async (rawArgs) => {
      const args = scheduleArgs.parse(rawArgs);
      const plan = estimateSchedule(args);
      return `${summarizeSchedule(plan)}\n\n${JSON.stringify(plan, null, 2)}`;
    },
  },
  {
    name: "risk_checklist",
    description: "根据项目模式与所属领域生成技术、市场、合规风险清单及应对措施。",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["tool", "business"] },
        domain: { type: "string", description: "所属行业领域" },
      },
      required: ["mode"],
      additionalProperties: false,
    },
    run: async (rawArgs) => {
      const args = riskArgs.parse(rawArgs);
      const items = riskChecklist(args);
      return `${summarizeRisks(items)}\n\n${JSON.stringify({ items }, null, 2)}`;
    },
  },
];

/** 供文档 / GET 描述接口使用的工具清单（不含执行函数） */
export function listMcpTools() {
  return MCP_TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

function errorResponse(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown
): McpResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

/**
 * 处理一条 MCP JSON-RPC 请求
 * @returns 通知类消息返回 null（无需响应）
 */
export async function handleMcpRequest(
  payload: unknown
): Promise<McpResponse | null> {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return errorResponse(null, -32600, "Invalid Request");
  }

  const request = payload as {
    jsonrpc?: unknown;
    id?: unknown;
    method?: unknown;
    params?: unknown;
  };

  const id: JsonRpcId =
    typeof request.id === "string" || typeof request.id === "number"
      ? request.id
      : null;

  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return errorResponse(id, -32600, "Invalid Request");
  }

  const method = request.method;
  const params = request.params;

  // JSON-RPC 通知不需要响应
  if (request.id === undefined && method.startsWith("notifications/")) {
    return null;
  }

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
        },
      };

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: listMcpTools() },
      };

    case "tools/call": {
      if (typeof params !== "object" || params === null) {
        return errorResponse(id, -32602, "Invalid params");
      }
      const { name, arguments: args } = params as {
        name?: unknown;
        arguments?: unknown;
      };
      if (typeof name !== "string") {
        return errorResponse(id, -32602, "工具名称不能为空");
      }

      const tool = MCP_TOOLS.find((item) => item.name === name);
      if (!tool) {
        return errorResponse(id, -32602, `未知工具：${name}`);
      }

      try {
        const text = await tool.run(args ?? {});
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text }],
            isError: false,
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return errorResponse(
            id,
            -32602,
            error.issues[0]?.message ?? "工具参数不合法"
          );
        }
        return errorResponse(
          id,
          -32603,
          error instanceof Error ? error.message : "工具执行失败"
        );
      }
    }

    default:
      return errorResponse(id, -32601, `Method not found: ${method}`);
  }
}
