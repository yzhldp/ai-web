# 十一、MCP 接入说明

本项目内置一个轻量 MCP Server，使用 **HTTP JSON-RPC 2.0** 传输，对外暴露知识检索、技术选型、排期估算与风险清单四类工具，可被外部 Agent / MCP 客户端直接调用。

---

## 一、端点与鉴权

| 项目 | 说明 |
| --- | --- |
| 服务发现 | `GET /api/mcp`（无需登录） |
| 调用端点 | `POST /api/mcp` |
| 传输协议 | HTTP JSON-RPC 2.0 |
| 协议版本 | `2024-11-05` |
| 鉴权方式 | 配置 `MCP_API_KEY` 后使用 `Authorization: Bearer <key>` 或 `x-mcp-key: <key>`；未配置时回退站内登录 Cookie |
| 限流 | 60 次 / 分钟（按用户或 API Key + IP） |
| 错误码 | `-32600` 非法请求、`-32601` 方法不存在、`-32602` 参数错误、`-32603` 执行异常 |

```bash
# 服务发现
curl -s http://localhost:3000/api/mcp
```

---

## 二、支持的方法

| 方法 | 说明 |
| --- | --- |
| `initialize` | 返回协议版本、能力与 serverInfo |
| `notifications/initialized` | 客户端初始化完成通知（无响应体） |
| `tools/list` | 返回工具名称、描述与 JSON Schema |
| `tools/call` | 调用指定工具并返回文本结果 |
| `ping` | 连通性检查 |

---

## 三、调用示例

### 1. 初始化

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MCP_API_KEY>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

### 2. 查询工具列表

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MCP_API_KEY>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

### 3. 调用技术选型工具

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <MCP_API_KEY>' \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"recommend_tech_stack",
      "arguments":{"scenario":"校园二手交易小程序","teamSize":3}
    }
  }'
```

返回结构：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "前端：...\n后端：..." }],
    "isError": false
  }
}
```

> 未配置 `MCP_API_KEY` 时，可携带站内登录 Cookie（`-b cookie.txt`）调用。

---

## 四、工具清单

| 工具 | 参数 | 返回 |
| --- | --- | --- |
| `search_knowledge_base` | `query`、`topK?` | 知识库检索结果与得分 |
| `recommend_tech_stack` | `scenario`、`teamSize?`、`priority?` | 前端 / 后端 / 数据库 / AI / 部署建议 |
| `estimate_schedule` | `moduleCount`、`teamSize?`、`complexity?` | 总工期、阶段与交付物 |
| `risk_checklist` | `mode`、`domain?` | 风险等级、类别、应对措施 |

所有工具与站内 Agent 的 Function Calling 复用同一套实现，结果可复现、可解释。

---

## 五、兼容性说明

- 当前实现覆盖 MCP 的工具发现与调用子集，适用于支持 HTTP JSON-RPC 的 MCP 客户端；
- 仅支持只读工具，不涉及文件系统、命令执行等高风险能力；
- 服务端不保存 MCP 调用内容，审计仅记录站内 Agent 的模型调用。

---

## 六、相关代码

- `src/lib/mcp/server.ts`：JSON-RPC 分发、工具定义与参数校验
- `src/app/api/mcp/route.ts`：HTTP 入口、鉴权与限流
- `src/lib/__tests__/mcp.test.ts`：协议与工具调用单元测试
