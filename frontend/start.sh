#!/bin/bash
# 获取当前脚本所在目录
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# 检查端口是否被占用，被占用就递增端口号
PORT=8000
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT+1))
done

export PORT=$PORT

if command -v node >/dev/null 2>&1; then
  if [ ! -d "node_modules" ]; then
    echo "📦 正在自动安装依赖项..."
    npm install
  fi
  echo "🚀 正在启动 HostCalculator SQLite 数据库后端服务器 (Node.js)，端口号: $PORT..."
  node server.js &
  SERVER_PID=$!
else
  echo "🚀 正在启动本地 Python 静态服务器 (无数据库 API)，端口号: $PORT..."
  python3 -m http.server $PORT > /dev/null 2>&1 &
  SERVER_PID=$!
fi

# 等待服务器启动
sleep 1

# 自动打开 Safari 浏览器 (如果是在 Mac 系统)
if command -v open >/dev/null 2>&1; then
  open "http://localhost:$PORT"
fi

echo "✅ 服务器已在后台运行。"
echo "🔗 访问地址: http://localhost:$PORT"
echo "🛑 按下 [Ctrl+C] 可以停止服务器并退出。"

# 捕获退出信号，退出时杀死服务器进程
trap "kill $SERVER_PID" EXIT

# 保持脚本运行以维持后台服务器
wait $SERVER_PID
