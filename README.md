# Texas Hold'em Poker Game

一个基于React和Node.js的在线德州扑克游戏，支持多人实时对战。

## 功能特点

- 🎯 完整的德州扑克游戏规则
- 👥 多人在线实时对战
- 🎨 美观的现代化UI界面
- 🔊 游戏音效支持
- 💬 实时聊天功能
- 🎴 流畅的卡牌动画效果
- 📱 响应式设计，支持移动设备

## 技术栈

### 前端
- React 19
- Vite
- Socket.IO Client
- CSS3 动画

### 后端
- Node.js
- Express
- Socket.IO
- Poker Evaluator

## 项目结构

```
texasholdem/
├── client/          # React前端应用
│   ├── src/
│   │   ├── components/  # React组件
│   │   ├── contexts/    # React上下文
│   │   ├── hooks/       # 自定义Hooks
│   │   └── utils/       # 工具函数
│   └── public/      # 静态资源
├── server/          # Node.js后端服务
│   ├── index.js     # 服务器入口
│   ├── game.js      # 游戏逻辑
│   └── Dockerfile   # Docker配置
└── README.md
```

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装和运行

1. 克隆仓库
```bash
git clone https://github.com/your-username/texasholdem.git
cd texasholdem
```

2. 安装后端依赖并启动服务器
```bash
cd server
npm install
npm run dev
```

3. 安装前端依赖并启动客户端
```bash
cd ../client
npm install
npm run dev
```

4. 在浏览器中访问 `http://localhost:5173`

### Docker 部署

```bash
cd server
docker build -t texasholdem-server .
docker run -p 3000:3000 texasholdem-server
```

## 游戏说明

1. 进入游戏后输入用户名
2. 选择或创建房间
3. 等待其他玩家加入
4. 开始游戏，享受德州扑克的乐趣！

## 开发

### 开发模式

后端开发服务器（端口3000）：
```bash
cd server
npm run dev
```

前端开发服务器（端口5173）：
```bash
cd client
npm run dev
```

### 构建

```bash
cd client
npm run build
```

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 许可证

MIT License