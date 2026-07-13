# Texas Hold’em Client

React 19 + Vite 前端，使用 Socket.IO Client 保持现有房间和游戏协议。界面提供白天/夜间现代牌室主题，并共享一套桌面、平板、手机竖屏和手机横屏组件。

## 本地开发

```bash
npm install
npm run dev
```

默认连接 `http://localhost:3000`。Playwright 使用 `VITE_API_URL=http://localhost:3100` 自动启动隔离测试服务。

## 验收命令

```bash
npm run build
npm run lint
npm run test:unit
npm run test:e2e
npm run test:visual
```

功能 E2E 连接真实本地 Socket 服务；视觉 E2E 使用 `src/dev/previewFixtures.js` 的确定性状态。更新视觉基线时使用：

```bash
npm run test:visual -- --update-snapshots
```

## 前端结构

- `src/screens/`：欢迎、连接、大厅和游戏四类页面。
- `src/components/game/`：牌桌、座位、公共牌、本人 HUD、行动区和侧栏。
- `src/components/lobby/`：共享聊天面板。
- `src/components/ui/`：Button、Input、Badge、Toast、确认弹窗、Modal 和 Sheet。
- `src/hooks/useGameViewModel.js`：页面状态、权限和行动能力的统一视图模型。
- `src/hooks/useChat.js`：聊天状态与未读计数，协议仍为 `sendMessage/newMessage`。
- `src/styles/tokens.css`：白天/夜间主题、间距、圆角、阴影和动效令牌。
- `src/dev/previewFixtures.js`：仅开发环境可用的确定性 UI 状态。

多端实现细节见仓库根目录的 `MOBILE_ADAPTATION.md`，阶段验收记录见 `UI_REFACTOR_ACCEPTANCE.md`。
