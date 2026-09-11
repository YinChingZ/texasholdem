# 状态与会话协议 v2

## 边界

- `server/index.js` 仅连接 HTTP / Socket.IO 与 `RoomService`，导出可独立启动和关闭的测试服务器。
- `server/room-service.js` 是房间命令、成员身份、场次和定时任务的唯一写入口。命令和定时事件同步完成，没有跨 `await` 的手牌写操作。异步存活探测返回后重新核验连接代次。
- `server/game.js` 只负责扑克规则、行动和结算。`playerId` 永不因连接改变；庄家以同一身份轮转。
- `client/src/services/sessionClient.js` 管理连接、身份恢复、凭证、确认与权威快照；React 通过 `useSyncExternalStore` 一次性接收一致状态。

所有状态仍在单进程内存中。重启会使房间失效，不支持多实例共享房间或重启恢复。没有账号体系，凭证持有者就是该会话的所有者。

## 状态和推进

房间包含成员、座位、房主、设置。场次有 `sessionId`、初始筹码、参赛记录和排行榜。手牌有 `handId`、当前 `turnId` 与行动期限。

| phase | 含义 | 推进方式 |
| --- | --- | --- |
| LOBBY | 新场次准备 | 房主开始，至少两名在线且有筹码的玩家 |
| BETTING | 当前手下注 | 当前玩家合法操作，或固定截止时间自动过牌/弃牌 |
| RUNOUT | 无需再下注，自动发公共牌 | 按手牌标识校验的逐街任务 |
| INTERMISSION | 结算完成 | 8 秒后自动发下一手；房主也可立即开始 |
| WAITING_PLAYERS | 可参赛人数不足 | 等待回到牌桌或新玩家入座，再开始 8 秒倒计时 |
| PAUSED | 房主暂停续局 | 房主恢复后重新倒计时 |
| ENDED | 场次结束 | 展示排行榜，房主重新准备；允许只剩一人时重置 |
| ERROR | 推进不变量失败 | 停止手牌任务并提供明确原因，房主重新准备或关闭 |

`gameState` 保留扑克阶段，用于牌桌展示；应用页面和操作权限优先使用 `phase` 和 `allowedActions`。每次发布递增 `revision`。同一行动中，聊天、设置、重连、无效命令不能重置截止时间，也不应产生虚假的过牌动画。

扣盲注后立即收敛到合法行动者或自动发牌。结算只保存一次，并先完成派彩，再发布完整结果。重置/关闭取消旧任务；回调同时核验任务对象、房间、手牌或场次，不得推进新的一手。

暂停与正常结束在本手结算后生效。关闭房间立即终止未结算手牌，界面明确告知。连续两次行动超时标记暂离，后续手牌不发牌；成功主动行动清零连续超时次数。

## 成员与恢复

成员的 `role`（player / spectator）、`connected`、`sittingOut`、`pendingSeat` 与扑克 `status` 分开表示。

- 玩家和旁观者都有随机恢复令牌。网络恢复不依赖旧连接已进入“断线名单”。
- 同一连接重复恢复返回当前快照。新连接到来时，旧页面有 3 秒响应存活探测；旧页面回应则保留操作权，新页面可明确接管。
- 接管原子替换绑定并递增 `generation`，旧连接所有写请求和迟到的断线通知均失效；旧页面收到 `sessionReplaced` 后不自动争抢。
- 断线保留本场身份、筹码和座位。当前手按原期限继续，弃牌与全押资格不被重连改写。回来后通过“回到牌桌”恢复后续参与；准备阶段刷新自动恢复准备资格。
- 新成员和旁观者可以在手间入座，手内申请先排队。释放离线座位只改变座位，保留原身份筹码。原身份输光后本场不可再领取筹码。
- 主动退出支持两种角色，并保留本场账本。前端按房间保存令牌，当前标签页单独保存恢复目标；返回首页和被接管不清除其他标签页的共享令牌。
- 房主断线 30 秒后，重新检查当前在线成员，优先在线玩家，其次在线旁观者，按入房顺序交接；主动退出立即交接。原房主回来不抢回权限。
- 全部成员离线时停止开新手牌，当前手仍能收敛。连续无人在线 30 分钟回收房间。

## 协议

所有命令使用 Socket.IO acknowledgement。发送结构含 `protocolVersion: 2` 和 `requestId`。成员命令还需要 `roomId`、当前连接 `generation`；下注额外携带 `handId`、`turnId`。

- `createRoom` / `joinRoom`：返回 `{ok, token, snapshot}`。加入已有身份的房间时客户端使用保存的令牌恢复，不再次创建身份。
- `resumeSession`：`{roomId, token, requestId, protocolVersion, takeover?}`，成功一次性返回身份、底牌与快照。令牌不出现在广播或日志。
- `roomSnapshot`：向每个连接分别发送的完整快照。包含公开的牌桌数据、成员连接状态、设置、`sessionId/handId/turnId/revision`、`serverNow`、行动截止、续局时间、等待原因、上一手结果、排行榜；`self` 和 `privateCards` 只给对应身份。
- `playerAction`：验证当前身份、行动阶段及版本，执行一次。重复 `requestId` 返回确认；同 ID 不同操作拒绝。请求记录有界，旧版本下注即使记录淘汰也不会被重新执行。
- `syncSession`：返回当前完整快照与本连接的身份令牌。
- `commandStatus`：用 `commandRequestId` 查询已确认操作，并同步当前快照；离桌后保留本连接的退出收据，用于确认丢失恢复。
- `pauseGame` / `resumeGame` / `prepareNextHand`：暂停、恢复及立即续局。
- `switchToPlayer` / `switchToSpectator` / `returnToTable` / `releaseSeat`：申请入座、手间离座、解除暂离、房主释放离线座位。
- `endGame` / `resetGame` / `closeRoom` / `leaveRoom`：结束、重新准备、关闭房间、退出。
- `sessionProbe`：旧页面通过 ack 回复 `{alive: true}`；`sessionReplaced` 表示操作权已交接。

失败返回 `{ok:false, code, message}`。`ROOM_GONE`、`INVALID_TOKEN` 才使匹配的本地凭证失效；`SESSION_IN_USE` 显示接管选择，`PROTOCOL_MISMATCH` 提示刷新；`STALE_TURN`、`SESSION_STALE` 要求同步。

没有已保存房间身份时，首次打开直接展示首页并在后台连接；连接尚未完成时允许编辑昵称、查看本地报告，但禁用创建/加入/练习操作。首次握手失败连续超过 3 秒才展示首页内的重试提示，自动重试成功后清除，不切换全屏连接/失败页。只有已有房间或有效恢复目标才展示独立连接与恢复页面。

客户端注册事件后才连接，恢复等待 8 秒，失败后按 1/2/4/8 秒重试（上限 8 秒）。网络未连上时手动重试实际调用连接函数，且可回首页。下注只允许在 `synced` 状态发送，使用非缓存发送。确认丢失先查询操作结果与快照，不自动重放下注。

快照版本只能前进；恢复时清空旧动画队列，一次性替换身份、底牌、角色。结算弹窗关闭不删除上一手结果，牌桌常驻倒计时和查看入口。旧 `gameStateUpdate` / `dealPrivateCards` 事件不再用于拼装状态。

## 配置、日志与验证

服务端环境变量：`TURN_TIMEOUT_MS=45000`、`NEXT_HAND_MS=8000`、`PACING_MS=600`、`HOST_GRACE_MS=30000`、`SESSION_PROBE_MS=3000`、`ROOM_IDLE_MS=1800000`。`PACING_MS` 仅控制发公共牌节奏，不再隐式禁用行动超时。

结构化日志包括恢复耗时和原因、拒绝命令、房主交接、行动超时、结算及推进不变量失败；不输出令牌和底牌。

```sh
npm --prefix server test
npm --prefix client test
npm --prefix client run lint
npm --prefix client run build
cd client
E2E_PORT=5178 E2E_API_PORT=3118 npx playwright test e2e/session-recovery.spec.js e2e/multiplayer-flow.spec.js --workers=1
```

服务端测试使用注入时钟验证期限、交接、全押、退出、幂等和多手筹码守恒。客户端覆盖超时、旧请求、身份替换、凭证隔离、确认丢失、快照与倒计时。浏览器测试使用独立上下文跑真实服务器，验证多人下注、刷新、同浏览器多页面接管、自动续局及首次连接失败。

发布时前后端同时切换协议 v2，选择没有活跃房间时重启；不迁移现有内存房间。旧页面收到版本错误后刷新。该变更不包含线上部署。
