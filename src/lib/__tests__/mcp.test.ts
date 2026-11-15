import { describe, expect, it } from "vitest";
import {
  MCP_PROTOCOL_VERSION,
  handleMcpRequest,
  listMcpTools,
} from "@/lib/mcp/server";

/** 断言返回体非空，便于后续取值 */
function requireResult(response: Awaited<ReturnType<typeof handleMcpRequest>>) {
  if (!response) throw new Error("期望返回 JSON-RPC 响应，实际为通知");
  return response;
}

describe("MCP Server - 协议基础能力", () => {
  it("initialize 返回协议版本与服务信息", async () => {
    const response = requireResult(
      await handleMcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      })
    );

    const result = response.result as {
      protocolVersion: string;
      capabilities: { tools: { listChanged: boolean } };
      serverInfo: { name: string; version: string };
    };
    expect(result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(result.capabilities.tools.listChanged).toBe(false);
    expect(result.serverInfo.name).toBe("creative-prototype-assistant");
  });

  it("ping 返回空结果", async () => {
    const response = requireResult(
      await handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "ping" })
    );
    expect(response.result).toEqual({});
  });

  it("notifications/initialized 为通知，不返回响应", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(response).toBeNull();
  });

  it("tools/list 返回 4 个带 JSON Schema 的工具", async () => {
    const response = requireResult(
      await handleMcpRequest({ jsonrpc: "2.0", id: 3, method: "tools/list" })
    );
    const tools = (response.result as { tools: unknown[] }).tools;
    expect(tools).toHaveLength(4);
    expect(listMcpTools().map((tool) => tool.name)).toEqual([
      "search_knowledge_base",
      "recommend_tech_stack",
      "estimate_schedule",
      "risk_checklist",
    ]);
    for (const tool of listMcpTools()) {
      expect(tool.inputSchema).toMatchObject({ type: "object" });
    }
  });
});

describe("MCP Server - tools/call", () => {
  it("recommend_tech_stack 返回技术选型文本", async () => {
    const response = requireResult(
      await handleMcpRequest({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "recommend_tech_stack",
          arguments: { scenario: "校园二手交易小程序", teamSize: 3 },
        },
      })
    );
    const result = response.result as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("前端");
    expect(result.content[0].text).toContain("部署");
  });

  it("estimate_schedule 返回总工期", async () => {
    const response = requireResult(
      await handleMcpRequest({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "estimate_schedule",
          arguments: { moduleCount: 6, teamSize: 2, complexity: "medium" },
        },
      })
    );
    const text = (response.result as { content: { text: string }[] }).content[0]
      .text;
    expect(text).toContain("总工期");
    expect(text).toContain("需求与设计");
  });

  it("search_knowledge_base 返回带得分的检索结果", async () => {
    const response = requireResult(
      await handleMcpRequest({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "search_knowledge_base",
          arguments: { query: "小团队如何做 RAG 和排期", topK: 2 },
        },
      })
    );
    const text = (response.result as { content: { text: string }[] }).content[0]
      .text;
    expect(text).toContain("title");
    expect(text).toContain("score");
  });

  it("risk_checklist 返回风险与应对措施", async () => {
    const response = requireResult(
      await handleMcpRequest({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "risk_checklist",
          arguments: { mode: "business", domain: "教育" },
        },
      })
    );
    const text = (response.result as { content: { text: string }[] }).content[0]
      .text;
    expect(text).toContain("未成年人");
    expect(text).toContain("→");
  });
});

describe("MCP Server - 错误处理", () => {
  it("未知方法返回 -32601", async () => {
    const response = requireResult(
      await handleMcpRequest({ jsonrpc: "2.0", id: 8, method: "unknown/method" })
    );
    expect(response.error?.code).toBe(-32601);
  });

  it("未知工具返回 -32602", async () => {
    const response = requireResult(
      await handleMcpRequest({
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: { name: "not_exist", arguments: {} },
      })
    );
    expect(response.error?.code).toBe(-32602);
  });

  it("工具参数非法返回 -32602", async () => {
    const response = requireResult(
      await handleMcpRequest({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: { name: "estimate_schedule", arguments: { moduleCount: 0 } },
      })
    );
    expect(response.error?.code).toBe(-32602);
  });

  it("非法请求体返回 -32600", async () => {
    const response = requireResult(await handleMcpRequest("not-an-object"));
    expect(response.error?.code).toBe(-32600);
  });
});
