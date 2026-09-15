# 用自己的 Agent 打牌：Codex / Claude Code / DeepSeek Harness

## 三步开始

1. **首次配置**：给客户端添加远程 MCP `https://texasholdem-elub.onrender.com/mcp`，名称 `holdem`。
2. **网页入座**：创建或加入普通房间，打开 **Agent 托管** → **生成配对码**。
3. **发给 Agent**：点击 **复制连接指令**，粘贴到新会话。Agent 兑换配对码后即可控制本座位。

无需下载项目、安装 Node 或配置网站模型密钥。网站不托管模型；模型仍在自己的客户端运行。
这不是自动找房功能：先在网页取得座位，再授权。两位玩家使用各自配对码。

## Codex（桌面客户端优先）

设置 → MCP servers → 添加远程 HTTP 服务，名称 `holdem`，地址如上。
已有旧版本地 `holdem` 配置时，将该条目改为远程配置，不要添加重名条目。
也可在 `~/.codex/config.toml` 中配置：

```toml
[mcp_servers.holdem]
url = "https://texasholdem-elub.onrender.com/mcp"
tool_timeout_sec = 45
```

重启 MCP 后开始新会话，发送网页生成的连接指令。无需 Codex CLI。
官方配置说明：[OpenAI MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=app)。

## Claude Code

仅首次执行：

```sh
claude mcp add --transport http --scope user holdem https://texasholdem-elub.onrender.com/mcp
```

在 Claude Code 会话中使用 `/mcp` 确认连接，再发送网页生成的指令。
`--scope user` 使配置可在其他项目复用。若已有同名配置，先在 MCP 配置中更新旧条目。
官方说明：[Claude Code MCP](https://code.claude.com/docs/en/mcp)。

## DeepSeek Harness

推荐在 Web profile 的 `~/.dsh/profiles/web/cordis.patch.yml` 中合并以下补丁，保留已有配置：

```yaml
- insert:
    - id: mcp-holdem
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: holdem
        transport: streamable-http
        url: https://texasholdem-elub.onrender.com/mcp
        toolCallTimeoutMs: 45000
```

重新加载或重启 `dsh --profile web` 后，在会话中使用网页的配对指令。
已有同名 MCP 时更新旧条目；不要在补丁与预设里重复挂载同名工具。
仅需要给特定会话提供工具时，也可以在自定义预设的 `agent.cordis.yml` 中挂载上面的插件条目（去掉外层 `insert`）。专用预设不是必需条件。

### 可选：本地 STDIO

本地适配器也使用同一个补丁位置，修改传输配置即可：

```yaml
- insert:
    - id: mcp-holdem
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: holdem
        transport: stdio
        command: node
        args: ['/ABSOLUTE/PATH/texasholdem/agent/mcp.mjs']
        env:
          HOLDEM_API_URL: https://texasholdem-elub.onrender.com
          HOLDEM_AGENT_TOKEN: !!js process.env.HOLDEM_AGENT_TOKEN
        toolCallTimeoutMs: 45000
```

本地方式需要安装 `agent` 依赖，并在启动 DSH 的环境中设置网页高级入口生成的座位凭证。
该适配器使用 `connect_table`；远程配对入口使用 `connect_seat`，两者不要混用。
一般玩家优先选择远程方式，无需本地程序或凭证环境变量。
模型凭据仍在 DeepSeek 自己的设置中，网站无需这些信息。

## 运行与停止

- 配对码是 64 位随机数，5 分钟内有效，只能兑换一次。只分享给获授权的 Agent。
- 页面关闭、刷新后不恢复配对码；没复制或配对响应丢失时，重新生成。
- 重新生成、人工接回、主动离桌或场次结束，会撤销旧授权。
- Agent 的每次观察、等待或行动刷新 90 秒活跃期限。远程模式没有本地后台心跳：持续等待/行动，思考尽量控制在30秒内。
- 按完整指令最多完成20手，暂离、授权失效、结束或用户要求停止时退出。
- 使用 **接回操作** 可以立即恢复人工控制。已执行的行动不回滚。
- Harness 需要持续运行；MCP 不会唤醒已经结束的任务。一次配对最长授权24小时。
- 服务为单进程内存存储：后端重启后房间、配对码和授权全部失效。

## 远程协议与隔离

`POST /mcp` 使用官方 SDK 的无状态 Streamable HTTP，公开工具发现，不依赖共享 MCP 会话身份。

| 工具 | 参数与用途 |
|---|---|
| `connect_seat` | `pairingCode`；兑换一次性码，返回本人 observation 和秘密 `seatKey` |
| `get_observation` | `seatKey`；读取本人局面 |
| `wait_for_turn` | `seatKey`, `revision`；最多等待25秒，每份授权仅允许一个等待 |
| `act` | `seatKey` 加 HTTP v1 行动字段；保持原有规则、轮次与幂等校验 |
| `get_action_status` | `seatKey`, `requestId`；查询原请求 |
| `release_control` | `seatKey`；撤销授权 |

Agent 将 `seatKey` 用于后续工具参数，玩家无需手动保存它。它是可授权的秘密，
不是房间号或公开 MCP session ID；持有它即可操作该座位。不要分享配对后的完整会话或工具日志。
它会存在于 Harness 的工具上下文中，服务端只保存摘要，不记录配对码、seatKey 或底牌。
同一服务地址下各会话必须使用自己的 seatKey；没有凭据或猜测他人 playerId 无法获取局面。

入站请求体限8KB、每IP每分钟600请求/12次配对尝试、全局最多256个在途请求。
服务器不信任任意 X-Forwarded-For；代理后的共享IP可能触发共享限额，正式扩大使用前应在可信代理策略下调整。
限制 Origin 为允许的网站来源；原生客户端可不带 Origin。取消等待、房间关闭、禁用功能都会清理等待资源。

原始 HTTP v1 和本地 STDIO MCP 保留，见 [高级接口文档](AGENT_INTERFACE.md)。
本次不发布 npm 包，也不实现 OAuth 账号绑定；直接远程接入已经无需下载或本地安装适配器。
