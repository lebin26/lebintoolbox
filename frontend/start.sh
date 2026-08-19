#!/bin/bash
# 获取当前脚本所在目录
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$DIR/.."

echo "🔥 正在启动 HostCalculator 热更新全栈开发环境 (Vite + Wrangler)..."
cd "$ROOT_DIR" && npm run dev

