@echo off
REM 德州扑克游戏 - Bug重现测试脚本
title 德州扑克游戏 - Bug重现测试

echo 🐛 德州扑克游戏 - "轮到其他玩家行动"Bug重现
echo ================================================

echo.
echo 📖 本脚本将指导您重现修复前的Bug
echo.
echo ⚠️  注意：此脚本用于演示Bug重现步骤
echo     如果您使用的是修复后的代码，Bug不会出现
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装，请先安装 Node.js
    pause
    exit /b 1
)

echo ✅ Node.js 已安装

REM 检查端口是否被占用
netstat -an | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo ⚠️  端口 3000 已被占用
) else (
    echo ✅ 端口 3000 可用
)

netstat -an | findstr ":5173" >nul
if %errorlevel% equ 0 (
    echo ⚠️  端口 5173 已被占用
) else (
    echo ✅ 端口 5173 可用
)

echo.
echo 🚀 启动服务器...
cd server
if not exist "node_modules" (
    echo 📦 安装服务器依赖...
    call npm install
)
start "德州扑克服务器" cmd /c "npm run dev"
cd ..

echo.
echo ⏳ 等待服务器启动...
timeout /t 3 /nobreak >nul

echo.
echo 🎮 启动客户端...
cd client
if not exist "node_modules" (
    echo 📦 安装客户端依赖...
    call npm install
)
start "德州扑克客户端" cmd /c "npm run dev"
cd ..

echo.
echo ✅ 服务器和客户端已启动
echo.
echo 🎯 Bug重现步骤（100%触发方法）:
echo.
echo 【方法1 - 重连时ID更新Bug】
echo 1. 打开两个浏览器窗口
echo 2. 玩家A创建房间，昵称"Alice"
echo 3. 玩家B加入房间，昵称"Bob" 
echo 4. 开始游戏，等待进入PREFLOP阶段
echo 5. 🔥 关键步骤：等到轮到Alice行动时
echo 6. 🔥 Alice刷新页面（触发重连）
echo 7. 🔥 重连成功后查看ActionBar
echo 8. 🐛 Bug现象：显示"轮到 Bob 行动"（错误）
echo.
echo 【方法2 - 玩家移除索引越界Bug】
echo 1. 创建3人房间：Alice、Bob、Charlie
echo 2. 开始游戏，进入PREFLOP阶段
echo 3. 🔥 等到轮到Charlie（第3个玩家）行动
echo 4. 🔥 Charlie直接关闭浏览器（完全关闭）
echo 5. 🔥 等待30秒让服务器移除Charlie
echo 6. 🐛 Bug现象：显示"轮到 undefined 行动"
echo.
echo 【方法3 - 快速重连状态混乱Bug】
echo 1. 两个玩家开始游戏
echo 2. 进入FLOP/TURN/RIVER任意阶段
echo 3. 🔥 当前行动玩家快速刷新2-3次
echo 4. 🐛 Bug现象：轮次显示混乱
echo.
echo 💡 调试技巧：
echo - 打开浏览器开发者工具查看Console日志
echo - 观察ActionBar中的"轮到xxx行动"显示
echo - 注意游戏状态更新时的玩家ID变化
echo.
echo 🔍 Bug验证方法：
echo - 如果看到错误的玩家名或"undefined"，说明Bug触发
echo - 如果轮次显示始终正确，说明Bug已修复
echo.
echo 📝 技术细节：
echo - Bug源于updatePlayerId方法的逻辑缺陷
echo - currentPlayerTurn索引管理不当
echo - _getGameState缺乏边界检查
echo.
echo 🛑 测试完成后请关闭服务器和客户端窗口
echo.
pause
