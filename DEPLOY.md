# 智慧教育AI平台 - 部署指南

## 系统架构

- **前端**: React + TypeScript + Vite + Tailwind CSS
- **后端**: Node.js + Express + Prisma + PostgreSQL
- **部署方式**: Docker Compose

## 快速部署（推荐）

### 1. 环境要求

- Docker 20.10+
- Docker Compose 2.0+

### 2. 部署步骤

```bash
# 1. 进入项目目录
cd /mnt/okcomputer/output

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

### 后端部署

```bash
# 1. 进入后端目录
cd backend

# 2. 安装依赖
npm install

# 3. 生成Prisma客户端
npx prisma generate

# 4. 初始化数据库
npx prisma db push

# 5. 编译TypeScript
npm run build

# 6. 启动服务
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

## 环境变量配置

### 后端 (.env)

```env
# 数据库
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartlearn?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# 邮件服务 (使用 ethereal.email 测试)
SMTP_HOST="smtp.ethereal.email"
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""

# 服务器
PORT=3001
NODE_ENV="production"
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

### 3. 作业管理系统
- 教师发布作业
- 学生提交作业（PDF和IPYNB格式）
- 在线预览批改
- 邮件提醒功能
- 数据导出

### 4. 数据分析
- 作业提交率/缺交率统计
- 班级成绩分布图
- 学生个人成绩走势图

## 数据备份

PostgreSQL数据库，建议定期备份：

```bash
# 创建备份目录
mkdir -p backup

# 备份数据库
pg_dump -h localhost -U postgres smartlearn > backup/smartlearn.$(date +%Y%m%d).sql

# 恢复数据库
psql -h localhost -U postgres smartlearn < backup/smartlearn.YYYYMMDD.sql

# 备份上传文件
cp -r backend/uploads backup/uploads.$(date +%Y%m%d)
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

## 安全建议

1. **生产环境务必修改JWT密钥**
2. **配置真实的邮件服务**（如SendGrid、AWS SES等）
3. **使用HTTPS**（配置SSL证书）
4. **定期备份数据**
5. **限制文件上传大小和类型**

## 技术支持

如有问题，请查看：
- 后端日志: `docker-compose logs backend`
- 前端构建: `cd app && npm run build`
- 数据库管理: `cd backend && npx prisma studio`
