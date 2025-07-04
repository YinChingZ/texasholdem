@echo off
REM 德州扑克游戏 - 重连功能测试脚本 (Windows版)
title 德州扑克游戏 - 重连功能测试

echo 🃏 德州扑克游戏 - 重连功能测试
echo ================================

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
echo 📋 测试指南:
echo 1. 打开浏览器，访问 http://localhost:5173
echo 2. 创建房间并开始游戏
echo 3. 进行以下测试：
echo    - 刷新页面测试重连
echo    - 断开网络连接测试
echo    - 多人游戏中的重连测试
echo    - 测试玩家轮次显示正确性
echo.
echo ⚡ 重连功能特点:
echo    - 30秒内自动重连
echo    - 保持游戏状态
echo    - 连接状态可视化
echo    - 修复轮次显示bug
echo.
echo 🐛 Bug修复说明:
echo    - 修复了"轮到其他玩家行动"的显示错误
echo    - 改进了玩家重连后的轮次管理
echo    - 增强了游戏状态同步的稳定性
echo.
echo 🎯 如需重现修复前的Bug，请运行：
echo    test_bug_reproduction.bat
echo.
echo 📚 相关文档：
echo    - BUG_REPRODUCTION_GUIDE.md  (详细重现步骤)
echo    - bug_example.js             (代码级别的Bug示例)
echo.
echo 🛑 关闭此窗口前请先关闭服务器和客户端窗口
echo.
pause
