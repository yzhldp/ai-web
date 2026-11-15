import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
  handleMcpRequest,
  listMcpTools,
} from "@/lib/mcp/server";

/**
 * GET /api/mcp —— MCP 服务描述与工具清单
 * 无需登录，便于 MCP 客户端与评审快速发现服务能力。
 */
export function GET() {
  return NextResponse.json(
    {
      ...MCP_SERVER_INFO,
      protocolVersion: MCP_PROTOCOL_VERSION,
      transport: "http-json-rpc",
      endpoint: "/api/mcp",
      tools: listMcpTools(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * POST /api/mcp —— MCP JSON-RPC 2.0 请求入口
 *
 * 鉴权：配置 MCP_API_KEY 时使用 Bearer / x-mcp-key；
 * 未配置时回退到登录会话，方便站内与评审直接调用。
 */
export async function POST(request: Request) {
  const configuredKey = process.env.MCP_API_KEY;
  let identity: string;

  if (configuredKey) {
    const auth = request.headers.get("authorization");
    const headerKey = request.headers.get("x-mcp-key");
    const provided = auth?.startsWith("Bearer ")
      ? auth.slice("Bearer ".length)
      : headerKey;
    if (provided !== configuredKey) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32001, message: "MCP 鉴权失败" },
        },
        { status: 401 }
      );
    }
    identity = "api-key";
  } else {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32001, message: "未登录且未配置 MCP_API_KEY" },
        },
        { status: 401 }
      );
    }
    identity = user.id;
  }

  const limited = rateLimit(
    `mcp:minute:${identity}:${getClientIp(request)}`,
    60,
    60_000
  );
  if (!limited.ok) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: `请求过于频繁，请 ${limited.retryAfter} 秒后重试`,
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfter) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400 }
    );
  }

  const result = await handleMcpRequest(body);
  // 通知类消息（如 notifications/initialized）无需响应体
  if (result === null) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
