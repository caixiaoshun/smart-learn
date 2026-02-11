#!/bin/bash

# 智慧教育AI平台 - 生产环境一键启动脚本
# 功能：构建并启动生产环境服务
# 用法：./start-prod.sh [--skip-build] [--reset-db]
#   --skip-build: 跳过构建步骤，直接启动服务
#   --reset-db: 重置数据库（清空所有数据）

set -e

# 解析命令行参数
SKIP_BUILD=false
RESET_DB=false
for arg in "$@"; do
    case $arg in
        --skip-build)
            SKIP_BUILD=true
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
echo "智慧教育AI平台 - 生产环境一键启动"
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

# 检查并创建 .env 文件
cd "$BACKEND_DIR"
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

# 数据库重置处理
if [ "$RESET_DB" = true ]; then
    echo ""
    echo "⚠️  警告: 将重置数据库，所有数据将被清空！"
    read -p "确认继续？(y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗄️ [后端] 重置数据库..."
        npx prisma db push --force-reset 2>/dev/null || true
        echo "   - PostgreSQL 数据库已重置"
    else
        echo "   - 取消数据库重置"
    fi
fi

if [ "$SKIP_BUILD" = false ]; then
    # ========== 后端构建 ==========
    echo ""
    echo "📦 [后端] 构建生产版本..."
    cd "$BACKEND_DIR"

    # 安装依赖
    echo "📦 [后端] 安装依赖..."
    npm ci

    # 生成 Prisma 客户端
    echo "🔧 [后端] 生成 Prisma 客户端..."
    npx prisma generate

    # 部署数据库迁移
    echo "🗄️ [后端] 部署数据库迁移..."
    npx prisma migrate deploy 2>/dev/null || npx prisma db push

    # 构建 TypeScript
    echo "🔨 [后端] 编译 TypeScript..."
    npm run build

    # ========== 前端构建 ==========
    echo ""
    echo "📦 [前端] 构建生产版本..."
    cd "$FRONTEND_DIR"

    # 安装依赖
    echo "📦 [前端] 安装依赖..."
    npm ci

    # 构建生产版本
    echo "🔨 [前端] 构建生产版本..."
    npm run build

    echo "✅ 构建完成"
else
    echo "⏭️ 跳过构建步骤（--skip-build）"
fi

# ========== 启动服务 ==========
echo ""
echo "======================================"
echo "🚀 启动生产服务器..."
echo "======================================"
echo "   后端服务: http://localhost:3001"
echo "   前端预览: http://localhost:4173"
echo ""

# 启动后端（后台运行）
cd "$BACKEND_DIR"
npm start &
BACKEND_PID=$!

# 启动前端预览服务器（前台运行）
cd "$FRONTEND_DIR"
npm run preview &
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
