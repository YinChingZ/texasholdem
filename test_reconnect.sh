#!/bin/bash

# 德州扑克游戏 - 重连功能测试脚本
# 这个脚本帮助快速启动测试环境

echo "🃏 德州扑克游戏 - 重连功能测试"
echo "================================"

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查端口是否被占用
check_port() {
    local port=$1
    if netstat -an | grep -q ":$port "; then
        echo "⚠️  端口 $port 已被占用"
        return 1
    else
        echo "✅ 端口 $port 可用"
        return 0
    fi
}

# 启动服务器
start_server() {
    echo "🚀 启动服务器..."
    cd server
    if [ ! -d "node_modules" ]; then
        echo "📦 安装服务器依赖..."
        npm install
    fi
    npm run dev &
    SERVER_PID=$!
    echo "✅ 服务器已启动 (PID: $SERVER_PID)"
    cd ..
}

# 启动客户端
start_client() {
    echo "🎮 启动客户端..."
    cd client
    if [ ! -d "node_modules" ]; then
        echo "📦 安装客户端依赖..."
        npm install
    fi
    npm run dev &
    CLIENT_PID=$!
    echo "✅ 客户端已启动 (PID: $CLIENT_PID)"
    cd ..
}

# 显示测试指南
show_test_guide() {
    echo ""
    echo "📋 测试指南:"
    echo "1. 打开浏览器，访问 http://localhost:5173"
    echo "2. 创建房间并开始游戏"
    echo "3. 进行以下测试："
    echo "   - 刷新页面测试重连"
    echo "   - 断开网络连接测试"
    echo "   - 多人游戏中的重连测试"
    echo ""
    echo "⚡ 重连功能特点:"
    echo "   - 30秒内自动重连"
    echo "   - 保持游戏状态"
    echo "   - 连接状态可视化"
    echo ""
    echo "🛑 按 Ctrl+C 停止所有服务"
}

# 清理函数
cleanup() {
    echo ""
    echo "🧹 清理进程..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
        echo "✅ 服务器进程已终止"
    fi
    if [ ! -z "$CLIENT_PID" ]; then
        kill $CLIENT_PID 2>/dev/null
        echo "✅ 客户端进程已终止"
    fi
    echo "👋 测试环境已关闭"
    exit 0
}

# 注册信号处理
trap cleanup SIGINT SIGTERM

# 主流程
main() {
    echo "🔍 检查端口状态..."
    check_port 3000
    check_port 5173
    
    echo ""
    echo "🎯 启动测试环境..."
    start_server
    sleep 3
    start_client
    
    show_test_guide
    
    # 等待用户中断
    while true; do
        sleep 1
    done
}

# 运行主函数
main
