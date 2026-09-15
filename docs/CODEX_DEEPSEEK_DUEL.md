# Codex 与 DeepSeek Harness 普通牌桌对战

## 当前部署与准备

网页：https://texasholdem.top 。游戏后端：https://texasholdem-elub.onrender.com 。
Render 游戏服务的 Environment 中设置 `AGENT_ENABLED=true` 并部署，Vercel 提供前端。
这是普通虚拟筹码牌桌，没有奖金或真实资金。双方各用自己的座位授权，网站不接收模型密钥。

本机项目位置：`/Users/xyz91928/Documents/Projects/texasholdem`。
需要 Node、已登录的 Codex 桌面客户端、已配置模型的 DeepSeek Harness。
首次安装依赖：在项目目录运行 `npm ci --prefix agent` 与 `npm ci --prefix client`。

## 1. 准备房间

在一个终端中运行，并保持窗口打开：

```sh
cd /Users/xyz91928/Documents/Projects/texasholdem
node agent/prepare-duel.mjs
```

它创建 Codex 和 DeepSeek Harness 两个普通座位，设置每次行动 120 秒。
分别将凭证保存到 `~/.config/holdem/codex.token` 和 `~/.config/holdem/deepseek.token`，文件仅本机用户可读。
输出房间号和网页邀请链接，不输出凭证。两个 Agent 连上后自动开局，最多 20 手。
已有本任务创建的房间时，不必重复运行：再次运行会创建另一房间并替换本地凭证。

此程序保留两个座位的浏览器侧连接以执行房主开局和结束操作；它不替模型决定如何出牌。
网络中断导致房主连接失效时，停止本次程序并重新准备房间。不要并行启动多个房间准备程序。

## 2. DeepSeek Harness

本机 Web 入口为 http://127.0.0.1:3080/ 。服务未运行时执行 `dsh --profile web`。
已配置专用预设：`~/.dsh/.agent-presets/holdem/agent.cordis.yml`。
新建空会话，选择工作区，在发送第一条消息前把“标准模式”切换为“德州扑克 Agent”。
该预设只加载 holdem 的六个工具；旧会话不能切换预设。
若列表未更新，刷新网页；仍不显示时重启 DeepSeek Web 服务。

将 `agent/prompts/duel.zh.md` 的完整内容复制到会话并发送。
若提示模型密钥缺失，在 DeepSeek 自己的设置中完成模型配置，不要把密钥发送给牌桌或写入 Prompt。

预设的 MCP 配置核心如下（其他机器应替换本地绝对路径）：

```yaml
- id: mcp-holdem
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: holdem
    transport: stdio
    command: /opt/homebrew/bin/node
    args: [/Users/xyz91928/Documents/Projects/texasholdem/agent/mcp.mjs]
    env:
      HOLDEM_API_URL: https://texasholdem-elub.onrender.com
      HOLDEM_AGENT_TOKEN_FILE: /Users/xyz91928/.config/holdem/deepseek.token
    toolCallTimeoutMs: 45000
    failOnStartupError: false
```

不要把这个座位的预设用于同时运行的多个会话。

## 3. Codex 桌面客户端（推荐）

本机已经在 `~/.codex/config.toml` 配置 `holdem` MCP；使用 `/opt/homebrew/bin/node`
启动本地适配器，凭证文件为 `~/.config/holdem/codex.token`。不需要运行 `codex` 命令。

1. 在 Codex 桌面客户端打开专用对战会话，或新建一个本地会话。
2. 确认 MCP 工具中出现 holdem 的六个工具。未出现时，在设置的 MCP servers 中重启服务；必要时重启客户端，再开会话。
3. 将 `agent/prompts/duel.zh.md` 的完整内容复制到会话并发送。
4. 保持会话运行。若出现审批，允许本场 holdem 牌桌工具。不要同时让两个 Codex 会话操作同一凭证。

官方配置说明：https://learn.chatgpt.com/docs/extend/mcp?surface=app 。

### 可选：CLI

仅在已安装 Codex CLI 且终端能找到 `codex` 时，才使用：

```sh
cd /Users/xyz91928/Documents/Projects/texasholdem
node agent/start-codex-duel.mjs
```

`spawn codex ENOENT` 表示找不到 CLI，不代表桌面客户端或牌桌 MCP 出错。
启动器提供同一份 Prompt 和本次运行的 MCP 配置；使用桌面客户端时无需此步骤。

如需手动配置其他 MCP 客户端，使用 Node STDIO 启动 `agent/mcp.mjs`，设置相同服务地址，
将 `HOLDEM_AGENT_TOKEN_FILE` 指向该客户端自己的座位凭证文件。
MCP 会在请求时读取文件，在后台每 20 秒发送心跳，心跳不调用模型。

## 4. 看牌与停止

双方连接后准备房间的终端显示“双方开始对战”。
打开输出的邀请链接，用第三个昵称加入；开局后加入可作为旁观者观看公开牌局。
不要误用第三个座位代替两个已创建的 Agent 座位。
准备程序只输出每手结束后的公开筹码。

最多 20 手后结束；有人输光或场次提前结束也可能更早停止。
在准备程序终端输入 `stop` 或按 Ctrl+C，可撤销两份授权并断开其浏览器侧连接。
也可在各 Harness 要求停止，它应调用 `release_control`。
浏览器自行创建座位的玩家可使用网页“接回操作”。

## 5. 常见问题

- `AGENT_DISABLED`：Render 后端开关未开启，或部署仍未生效。
- `CREDENTIAL_REQUIRED`：尚未准备房间，或凭证文件路径错误。
- `INVALID_GRANT`：授权已撤销、过期，或服务重启使内存房间失效；重新准备房间。
- `STALE_TURN`：观察已过期，重新观察，不用新请求 ID 重放旧下注。
- DeepSeek 没有 holdem 工具：确认使用新的“德州扑克 Agent”会话；检查本机 Node 路径与 agent 依赖。
- Agent 暂离：停止循环，由座位拥有者恢复入桌；演示房间可结束后重新创建。
- 等待后 Agent 结束回答：重新发持续执行 Prompt；Harness 必须持续运行，MCP 心跳不能代替模型执行任务。

完整循环、重试规则与停止条件见 `agent/prompts/duel.zh.md`。
API、权限及内存存储限制见 `docs/AGENT_INTERFACE.md`。
