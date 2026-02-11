# 智慧教育AI平台 - 部署指南

## 系统架构

- **前端**: React 19 + TypeScript + Vite 7 + Tailwind CSS + shadcn/ui
- **后端**: Node.js + Express + Prisma + PostgreSQL
- **文件存储**: MinIO / S3 兼容对象存储
- **部署方式**: Docker Compose 或手动部署

## 快速部署（推荐）

### 1. 环境要求

- Docker 20.10+
- Docker Compose 2.0+

### 2. 部署步骤

```bash
# 1. 进入项目目录
cd smart-learn

# 2. 启动服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f
```

### 3. 访问服务

- 前端: http://localhost
- 后端API: http://localhost/api
- 健康检查: http://localhost/api/health

## 手动部署

### PostgreSQL 数据库安装

```bash
# macOS (使用 Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# 创建数据库
createdb smartlearn -U postgres
# 或者登录 psql 后执行: CREATE DATABASE smartlearn;
```

### MinIO 对象存储安装（可选）

```bash
# Docker 方式 (推荐)
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# macOS (使用 Homebrew)
brew install minio/stable/minio
minio server ~/minio-data

# 访问 MinIO 控制台: http://localhost:9001
# 默认用户名/密码: minioadmin/minioadmin
```

### 后端部署

```bash
# 1. 进入后端目录
cd backend

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少配置 DATABASE_URL 和 JWT_SECRET
# 如果使用 MinIO，配置 S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET_NAME

# 3. 安装依赖
npm install

# 4. 生成Prisma客户端
npx prisma generate

# 5. 初始化数据库
npx prisma db push

# 6. 编译TypeScript
npm run build

# 7. 启动服务
npm start
```

### 前端部署

```bash
# 1. 进入前端目录
cd app

# 2. 安装依赖
npm install

# 3. 构建（使用生产环境配置）
npm run build

# 4. 构建产物在 dist/ 目录，可使用Nginx等服务器部署
```

### 一键启动脚本

项目提供了便捷的启动脚本：

```bash
# 开发环境一键启动
./scripts/start-dev.sh
# 可选参数: --keep-db (保留数据库) --reset-db (重置数据库)

# 生产环境启动
./scripts/start-prod.sh
# 可选参数: --skip-build (跳过构建) --reset-db (重置数据库)
```

## 环境变量配置

### 后端 (.env)

```env
# 数据库 (必须)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartlearn?schema=public"

# JWT (必须)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# 邮件服务 (SMTP 配置)
SMTP_HOST="smtp.ethereal.email"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM_NAME="智慧教育AI平台"
SMTP_FROM_EMAIL="noreply@edu-platform.com"

# 服务器
PORT=3001
NODE_ENV="production"
FRONTEND_URL="http://localhost:5173"

# AI 接口配置 (OpenAI 兼容，可选)
AI_BASE_URL="https://api.openai.com"
AI_API_KEY=""

# MinIO / S3 对象存储 (可选)
S3_ENDPOINT="http://127.0.0.1:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET_NAME="smart-learn"
```

### 前端 (.env.production)

```env
VITE_API_URL=/api
```

## 功能特性

### 1. 身份认证模块
- 邮箱+验证码注册/登录
- 支持邮箱+密码登录
- 找回密码功能
- JWT Token认证

### 2. 班级管理
- 教师创建多个班级（一对多）
- 学生加入班级（多对一）
- 邀请码机制
- 成员管理

### 3. 作业管理系统
- 教师发布作业（普通作业/项目小组作业/自主实践作业）
- 学生提交作业（PDF和IPYNB格式）
- 在线预览批改（PDF 内联、IPYNB JSON 预览）
- AI 辅助批改建议
- 邮件提醒功能
- 作业动态组队（自动分组/手动调整）
- 同行互评管理（匿名评审/评审分配）
- 数据导出（CSV/JSON）

### 4. 资源中心
- 教学资源上传与管理
- 分类/标签搜索过滤
- 收藏、评论、浏览量统计
- 优秀作业推荐至资源中心

### 5. 数据分析
- 作业提交率/缺交率统计
- 班级成绩分布图
- 学生个人成绩走势图
- 学生行为数据分析
- 精准干预控制台

### 6. 平时表现管理
- 课堂表现记录
- 知识点评估
- 成绩追踪

## 数据备份

PostgreSQL数据库，建议定期备份：

```bash
# 创建备份目录
mkdir -p backup

# 备份数据库
pg_dump -h localhost -U postgres smartlearn > backup/smartlearn.$(date +%Y%m%d).sql

# 恢复数据库
psql -h localhost -U postgres smartlearn < backup/smartlearn.YYYYMMDD.sql
```

## 故障排查

### 1. 后端无法启动

```bash
# 检查日志
docker-compose logs backend

# 手动运行查看错误
cd backend && npm run dev
```

### 2. 数据库问题

```bash
# 重置数据库
cd backend && npx prisma db push --force-reset

# 查看数据库
cd backend && npx prisma studio
```

### 3. 前端无法连接后端

- 检查 `.env.production` 中的 `VITE_API_URL` 配置
- 确保Nginx配置正确代理API请求
- 检查浏览器控制台网络请求

### 4. MinIO 连接问题

- 检查 MinIO 服务是否运行: `curl http://127.0.0.1:9000/minio/health/live`
- 检查 `.env` 中的 S3 配置是否正确
- 确保 bucket 已创建（应用启动时会自动创建）

## 安全建议

1. **生产环境务必修改JWT密钥**
2. **配置真实的邮件服务**（如SendGrid、AWS SES等）
3. **使用HTTPS**（配置SSL证书）
4. **定期备份数据**
5. **限制文件上传大小和类型**
6. **修改 MinIO 默认密码**

## 技术支持

如有问题，请查看：
- 后端日志: `docker-compose logs backend`
- 前端构建: `cd app && npm run build`
- 数据库管理: `cd backend && npx prisma studio`
- MinIO 控制台: `http://localhost:9001`
