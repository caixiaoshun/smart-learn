#!/bin/bash

# 智慧教育AI平台 - 开发环境一键启动脚本
# 功能：一键启动前端和后端开发服务
# 用法：./start-dev.sh [--keep-db] [--reset-db]
#   --keep-db: 保留开发数据库文件，不进行删除
#   --reset-db: 强制重置数据库（清空所有数据）

set -e

# 解析命令行参数
KEEP_DB=false
RESET_DB=false
for arg in "$@"; do
    case $arg in
        --keep-db)
            KEEP_DB=true
            ;;
        --reset-db)
            RESET_DB=true
            ;;
    esac
done

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/app"

echo "======================================"
echo "智慧教育AI平台 - 开发环境一键启动"
echo "======================================"

# 检查 npm 是否可用
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: npm 未安装或不在 PATH 中"
    echo "   请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 检查目录是否存在
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ 错误: 后端目录不存在: $BACKEND_DIR"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ 错误: 前端目录不存在: $FRONTEND_DIR"
    exit 1
fi

# ========== 后端设置 ==========
echo ""
echo "📦 [后端] 设置开发环境..."
cd "$BACKEND_DIR"

# 清理残留产物
echo "🧹 [后端] 清理残留产物..."
[ -d "dist" ] && rm -rf dist && echo "   - 删除 dist 目录"

# 数据库处理
if [ "$RESET_DB" = true ]; then
    echo "🗄️ [后端] 强制重置数据库..."
    npx prisma db push --force-reset 2>/dev/null || true
    echo "   - 已重置 PostgreSQL 数据库"
elif [ "$KEEP_DB" = true ]; then
    echo "   - 保留数据库数据（--keep-db）"
fi

# 检查并创建 .env 文件
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📝 [后端] 创建 .env 文件..."
        cp .env.example .env
        echo "   - 已从 .env.example 创建 .env 文件"
        echo "   ⚠️  请根据需要修改 .env 中的配置"
    else
        echo "❌ 错误: 找不到 .env.example 文件"
        exit 1
    fi
else
    echo "✅ [后端] .env 文件已存在"
fi

# 安装依赖
echo "📦 [后端] 安装依赖..."
npm install

# 生成 Prisma 客户端
echo "🔧 [后端] 生成 Prisma 客户端..."
npx prisma generate

# 初始化数据库
echo "🗄️ [后端] 初始化数据库..."
npx prisma db push

# ========== 前端设置 ==========
echo ""
echo "📦 [前端] 设置开发环境..."
cd "$FRONTEND_DIR"

# 清理残留产物
echo "🧹 [前端] 清理残留产物..."
[ -d "dist" ] && rm -rf dist && echo "   - 删除 dist 目录"

# 安装依赖
echo "📦 [前端] 安装依赖..."
npm install

# ========== 启动服务 ==========
echo ""
echo "======================================"
echo "🚀 启动开发服务器..."
echo "======================================"
echo "   后端服务: http://localhost:3001"
echo "   前端服务: http://localhost:5173"
echo ""

# 启动后端（后台运行）
cd "$BACKEND_DIR"
npm run dev &
BACKEND_PID=$!

# 启动前端（前台运行）
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

# 捕获退出信号，停止所有服务
cleanup() {
    echo ""
    echo "🛑 停止服务..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# 等待服务运行
wait
