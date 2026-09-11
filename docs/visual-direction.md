# 界面方向与约束

用户已明确否定入口大图与环形牌桌。后续不要恢复这两项；不能用增加装饰、材质或换色代替信息布局的改进。

当前采用开放排列：

- 入口只保留昵称、创建房间、输入房间号和加入。
- 对手按座次从左至右排列，一到两行；全员始终可见。
- 公共牌和底池居中；本人大手牌、筹码和行动按钮相邻。
- 手机横屏将对手集中为一行，公共牌和本人区域左右安排。
- 摊牌时为公开手牌增加行间空间，不让下一排席位遮挡手牌。
- 不画实体桌子，不做透视桌沿，不放宣传大图。

布局由 `client/src/components/game/tableLayout.js` 统一计算，静态下注和筹码动画共用锚点。亮牌范围、下注金额和行动权限沿用原有游戏状态。

本地预览：

- [入口](http://localhost:5173/?uiPreview=welcome&theme=dark)
- [八人局](http://localhost:5173/?uiPreview=game-eight&theme=dark)
- [大额筹码](http://localhost:5173/?uiPreview=game-stress&theme=dark)
- [全桌摊牌](http://localhost:5173/?uiPreview=game-reveal-eight&theme=dark)

## 玩家状态与结算（2026-09-11）

保留已确认的开放式牌桌布局。玩家状态占用固定状态行：行动中为薄荷绿描边，ALL IN 为暖琥珀色，弃牌为灰色，离线为蓝灰色；所有状态保留高对比筹码。离线图标可与弃牌、全押同时出现。动作提示短暂替换状态文字，不改变座位布局。

派彩后以金色边框与奖杯标记赢家，关闭结果后保留，下一手清除。结算首屏展示赢家、赢得金额、牌型和服务端已公开的获胜手牌；其他摊牌明细按需展开，不推断未公开手牌。

预览：`?uiPreview=game-player-states&theme=dark`、`?uiPreview=game-reveal-eight&theme=dark`、`?uiPreview=result-split&theme=dark`。

检查：65 项客户端单元测试、50 项功能端到端测试通过；45 张视觉快照重新检查；代码检查与构建通过。已检查桌面、360px 手机、手机横屏、深浅主题、八人摊牌及平分/边池结算。
