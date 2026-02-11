#!/bin/bash

# ============================================================
# 🧨 全系统暴力重置脚本 (PostgreSQL + MinIO)
# 警告：此操作不可逆，将永久删除所有数据库数据及对象存储文件！
# ============================================================

# --- 1. 参数配置 ---

# PostgreSQL 配置
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="smartlearn"
DB_USER="postgres"
DB_PASS="123456"

# MinIO 配置
MINIO_URL="http://localhost:9000"
MINIO_CONSOLE="http://localhost:9001"
MINIO_USER="minioadmin"
MINIO_PASS="minioadmin"
MINIO_ALIAS="local_minio"

echo "===================================================="
echo "⚠️  确认：即将开始全系统重置"
echo "===================================================="
echo "PostgreSQL: $DB_NAME @ $DB_HOST"
echo "MinIO API:  $MINIO_URL"
echo "===================================================="

# --- 2. 重置 PostgreSQL ---

echo "🐘 [1/2] 正在重置 PostgreSQL 数据库..."
export PGPASSWORD=$DB_PASS

if command -v psql &> /dev/null; then
    SQL="DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$SQL" > /dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ PostgreSQL 已重置为初始状态。"
    else
        echo "❌ PostgreSQL 重置失败，请检查连接。"
    fi
else
    echo "⚠️  跳过：未找到 psql 客户端。"
fi

unset PGPASSWORD

echo "----------------------------------------------------"

# --- 3. 重置 MinIO ---

echo "🌊 [2/2] 正在清空 MinIO 对象存储..."

if command -v mc &> /dev/null; then
    # 设置连接别名 (隐身模式，不显示配置过程)
    mc alias set $MINIO_ALIAS $MINIO_URL $MINIO_USER $MINIO_PASS --api S3v4 > /dev/null
    
    if [ $? -eq 0 ]; then
        # 获取所有存储桶并强制删除 (rb --force 会同时删除桶内所有文件)
        buckets=$(mc ls $MINIO_ALIAS | awk '{print $5}')
        
        if [ -z "$buckets" ]; then
            echo "ℹ️  MinIO 已经是空的，无需清理。"
        else
            for bucket in $buckets; do
                # 去掉路径末尾的斜杠
                b_name=${bucket%/}
                echo "🗑️  正在销毁存储桶: $b_name"
                mc rb --force $MINIO_ALIAS/$b_name > /dev/null
            done
            echo "✅ MinIO 所有存储桶已清空。"
        fi
    else
        echo "❌ MinIO 连接失败，请检查服务是否运行。"
    fi
else
    echo "⚠️  跳过：未找到 MinIO Client (mc)。请安装后重试。"
fi

# --- 4. 总结 ---

echo "===================================================="
echo "🏁 重置任务已执行完毕！"
echo "----------------------------------------------------"
echo "API 地址:     $MINIO_URL"
echo "控制台地址:   $MINIO_CONSOLE"
echo "数据库状态:   已重置 (public schema 已清空)"
echo "下一步建议:   运行 Prisma db push 或其他迁移工具重新建表。"
echo "===================================================="