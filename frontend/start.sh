#!/bin/bash
# 获取当前脚本所在目录
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# 检查端口是否被占用，被占用就递增端口号
PORT=8000
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT+1))
done

echo "🚀 正在启动 HostCalculator 前端本地服务器，端口号: $PORT..."
python3 -m http.server $PORT > /dev/null 2>&1 &
SERVER_PID=$!

# 等待服务器启动
sleep 0.5

# 自动打开浏览器
if command -v open >/dev/null 2>&1; then
  open "http://localhost:$PORT"
fi

echo "✅ 前端服务器已在后台运行。"
echo "🔗 访问地址: http://localhost:$PORT"
echo "🛑 按下 [Ctrl+C] 可以停止服务器并退出。"

# 捕获退出信号，退出时杀死服务器进程
trap "kill $SERVER_PID" EXIT

# 保持脚本运行以维持后台服务器
wait $SERVER_PID
