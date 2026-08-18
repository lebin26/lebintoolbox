#!/bin/bash
# 获取当前脚本所在目录
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

WORKER_PID=""

# 1. 检查 8787 端口，若未启动则自动启动 Cloudflare Worker 本地 API & D1 数据库
if ! lsof -i :8787 >/dev/null 2>&1; then
  echo "⚡ 正在启动后端 Worker API 与本地 D1 数据库 (端口: 8787)..."
  (cd "$DIR/../worker" && npx wrangler dev) > /dev/null 2>&1 &
  WORKER_PID=$!
  sleep 2
fi

# 2. 检查端口号，递增查找可用的前端端口号
PORT=8000
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT+1))
done

echo "🚀 正在启动 HostCalculator 前端本地服务器 (端口: $PORT)..."
python3 -m http.server $PORT > /dev/null 2>&1 &
SERVER_PID=$!

# 等待服务器启动
sleep 0.5

# 自动打开浏览器
if command -v open >/dev/null 2>&1; then
  open "http://localhost:$PORT"
fi

echo "✅ 本地全栈开发环境已成功运行："
echo "   - 🌐 前端网页: http://localhost:$PORT"
echo "   - ⚡ 后端 D1 API: http://localhost:8787"
echo "🛑 按下 [Ctrl+C] 可同时停止所有服务并退出。"

# 捕获退出信号，退出时杀死前端与 Worker 进程
trap "kill $SERVER_PID $WORKER_PID 2>/dev/null" EXIT

# 保持脚本运行以维持后台服务器
wait $SERVER_PID
