# 多端 UI 适配说明

前端使用同一套 React 组件覆盖桌面、平板、手机竖屏和低高度横屏。旧版 `client/src/mobile.css` 已删除；响应式规则与组件放在相同的 CSS Module 中，避免跨页面覆盖。

## 布局策略

| 场景 | 布局 |
| --- | --- |
| 大于 1024px | 游戏桌与 320px 右侧聊天/控制栏 |
| 701–1024px | 游戏区全宽，聊天与控制使用右侧抽屉 |
| 不超过 700px | 顶部玩家横向条、中央牌桌、底部 HUD，聊天与控制使用 Bottom Sheet |
| 横屏且高度不超过 500px | 左侧牌桌、右侧手牌与操作区 |

游戏页使用 `100dvh`、`env(safe-area-inset-*)`、`clamp()` 和牌桌容器查询。移动玩家条可横向滚动，但页面本身不产生横向滚动。所有主要触控目标不小于 44×44px。

## 组件职责

- `GameHeader`：房间、牌局阶段、身份、聊天和控制入口。
- `TableStage`：2–8 人座位、移动玩家条、公共牌和奖池。
- `HeroPanel` / `ActionDock`：本人手牌、筹码、行动和加注面板。
- `GameSidebar`：桌面聊天和牌桌控制。
- `MobileSheet`：平板抽屉与手机 Bottom Sheet，包含焦点循环、Escape、遮罩和焦点回收。
- `ModalDialog`：结算、排行榜和音效设置的统一弹层。

## 设计令牌与主题

令牌位于 `client/src/styles/tokens.css`。默认使用白天主题，可切换夜间主题；选择保存在 `texasholdem_theme`。

- 颜色：`--color-app`、`--color-surface*`、`--color-felt*`、`--color-gold` 和语义状态色。
- 间距：`--space-1` 至 `--space-8`。
- 圆角：`--radius-sm` 至 `--radius-xl`。
- 动效：`--duration-*` 与 `--ease-standard`。
- 字体：`--font-sans` 和 `--font-mono`。

`prefers-reduced-motion: reduce` 会关闭循环和位移动画。`!important` 仅保留在这组可访问性覆盖中。

## 验收视口

自动化覆盖 320、360、390、480、768、1024、1280 和 1600px 宽度，以及 844×390 横屏、390×500 软键盘等效视口和 1600×900 在 200% 浏览器缩放时的 800×450 有效视口。

```bash
cd client
npm run test:e2e
npm run test:visual
```

开发环境可使用 `http://localhost:5173/?uiPreview=<state>&theme=light` 查看确定性状态。完整状态和人工验收项见 `UI_REFACTOR_ACCEPTANCE.md`。
