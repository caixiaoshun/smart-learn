<div align="center">

# 🎓 Smart Learn - 智慧教育 AI 平台

*基于 React 和 AI 的智能教学平台 | AI-Powered Intelligent Teaching Platform*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646cff?logo=vite)](https://vitejs.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright)](https://playwright.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)

</div>

---

## 📖 项目全景

**Smart Learn** 是一个全栈 AI 智能教学平台，面向学生和教师双端，提供个性化学习辅助与精准教学管理。平台深度集成 AI 能力，涵盖班级管理、分层作业发布、AI 学习助手、学情分析与精准干预等核心功能。

前端采用 React 19 + TypeScript + Vite 构建，后端基于 Node.js + Express + PostgreSQL (Prisma ORM)，通过 Playwright 进行 E2E 自动化测试，确保产品质量。

## ✨ 核心功能清单

### 🎒 学生端

| 功能 | 说明 |
|------|------|
| **仪表盘** | 总积分/排名/课程进度/AI互动指数、近7天学习趋势、五维能力雷达、最近活动；支持导出学习报告、AI 诊断跳转 |
| **AI 智能助手** | 基于 OpenAI 兼容 API 的 SSE 流式对话、多模型选择、聊天历史持久化、Socratic 引导式教学 |
| **资源库** | 按类型/分类/标签搜索过滤教学资源，支持收藏、浏览量统计 |
| **作业提交** | 查看/提交作业（PDF/Notebook），文件预览（PDF 内联、IPYNB JSON），截止时间提醒 |
| **学情分析** | 个人成绩趋势、得分走势统计 |
| **个人设置** | 资料编辑、头像上传、密码修改、通知偏好、隐私权限 |

### 🏫 教师端

| 功能 | 说明 |
|------|------|
| **仪表盘** | 授课学生数/班级数/提交率/待关注学生、最近动态、待办任务、快捷入口 |
| **班级管理** | 创建班级（自动邀请码）、成员管理、班级编辑/删除 |
| **分层作业发布** | 发布作业（标题/描述/截止时间/满分/迟交设置）、AI 辅助生成分层作业（基础层/进阶层/挑战层） |
| **学生行为分析** | 学生行为数据分析、导出报表、生成关注清单 |
| **精准干预控制台** | 预警学生管理、行为评分筛选（全部/预警/高分）、AI 推荐方案、干预资源推送 |
| **数据分析** | 班级作业分析（提交率/分数分布）、成绩趋势、班级总览排名 |

### 🔐 通用功能

- 邮箱验证码注册/登录/密码重置
- JWT 鉴权 + 角色守卫（STUDENT / TEACHER）
- 全局搜索、通知系统
- 思政案例库（创建/浏览/评分/收藏）

## 🏗️ 技术栈详情

| 层 | 技术 |
|----|------|
| **前端框架** | React 19, TypeScript, Vite 7 |
| **UI 组件库** | Tailwind CSS, shadcn/ui (Radix UI), Lucide Icons |
| **状态管理** | Zustand (with localStorage persist) |
| **路由** | React Router 7 |
| **数据可视化** | Recharts |
| **HTTP 客户端** | Axios |
| **通知** | Sonner (Toast) |
| **后端** | Node.js, Express, TypeScript, Prisma ORM, Zod |
| **数据库** | PostgreSQL 15+ |
| **认证** | JWT (jsonwebtoken), bcryptjs |
| **文件上传** | Multer (本地磁盘 `uploads/`) |
| **邮件** | Nodemailer (SMTP) |
| **AI** | OpenAI 兼容 API (SSE 流式) |
| **定时任务** | node-cron |
| **E2E 测试** | Playwright |

## 📁 目录结构

```
smart-learn/
├── app/                            # 前端 React 应用
│   ├── src/
│   │   ├── App.tsx                 # 路由定义 + 角色守卫
│   │   ├── main.tsx                # 入口
│   │   ├── components/             # UI 组件
│   │   │   ├── ui/                 # shadcn/ui 基础组件
│   │   │   ├── charts/             # 图表组件
│   │   │   ├── chat/               # AI 聊天组件
│   │   │   └── layout/             # 布局 (MainLayout, AuthLayout)
│   │   ├── pages/
│   │   │   ├── auth/               # 登录、注册、找回密码
│   │   │   ├── student/            # 学生端所有页面
│   │   │   └── teacher/            # 教师端所有页面
│   │   ├── stores/                 # Zustand 状态管理
│   │   ├── hooks/                  # 自定义 Hooks
│   │   ├── lib/                    # API 客户端 (Axios)、工具函数
│   │   └── types/                  # TypeScript 类型定义
│   ├── package.json
│   └── vite.config.ts
├── backend/                        # 后端 Express 应用
│   ├── src/
│   │   ├── index.ts                # 入口 + 路由注册
│   │   ├── routes/                 # API 路由 (auth, class, homework, resource, case, ai, analytics, dashboard)
│   │   ├── middleware/             # JWT 认证、文件上传、限流
│   │   ├── services/               # 业务服务 (作业提醒 cron)
│   │   └── utils/                  # 工具 (JWT, 邮件)
│   ├── prisma/schema.prisma        # 数据库模型定义
│   ├── uploads/                    # 上传文件目录
│   └── .env.example                # 环境变量示例
├── e2e/                            # E2E 自动化测试 (Playwright)
│   ├── tests/
│   │   ├── auth.spec.ts            # 认证模块测试 (登录/注册/权限/登出)
│   │   ├── student.spec.ts         # 学生端测试 (仪表盘/作业/资源/AI/设置)
│   │   ├── teacher.spec.ts         # 教师端测试 (仪表盘/班级/作业/分析)
│   │   ├── teacher-intervention.spec.ts  # 干预控制台深度交互测试
│   │   ├── student-homework.spec.ts      # 学生作业深度交互 + 文件上传测试
│   │   ├── routing.spec.ts         # 路由、重定向、404 测试
│   │   ├── mobile.spec.ts          # 移动端适配测试
│   │   ├── fixtures.spec.ts        # 测试 Fixture 验证
│   │   └── helpers/
│   │       └── generate-fixtures.ts  # PDF/Notebook 测试文件生成
│   ├── fixtures/                   # 生成的测试文件
│   └── playwright.config.ts
├── scripts/
│   ├── start-dev.sh                # 开发环境一键启动
│   └── start-prod.sh               # 生产环境启动
├── DEPLOY.md                       # 部署文档
├── LICENSE
└── README.md
```

## 🚀 开发指南

### 环境要求

- **Node.js** 20.x+
- **PostgreSQL** 15+
- **npm**

### 方式一：一键启动（推荐）

```bash
# 克隆项目后，使用一键启动脚本
./scripts/start-dev.sh

# 可选参数:
#   --keep-db    保留开发数据库
#   --reset-db   强制重置数据库
```

脚本会自动安装依赖、生成 Prisma Client、初始化数据库并同时启动前端和后端服务。

### 方式二：手动启动

**1. 配置并启动后端**

```bash
cd backend
cp .env.example .env
# 编辑 .env，至少配置 DATABASE_URL 和 JWT_SECRET
npm install
npx prisma generate
npx prisma db push
npm run dev
# 后端运行在 http://localhost:3001
```

**2. 启动前端（新终端）**

```bash
cd app
npm install
npm run dev
# 前端运行在 http://localhost:5173
```

### 运行 E2E 测试

E2E 测试基于 Playwright，在前端运行的情况下执行：

```bash
cd e2e
npm install
npx playwright install chromium    # 首次运行需安装浏览器

# 运行所有测试
npm test

# 带浏览器界面运行（方便调试）
npm run test:headed

# 查看测试报告
npm run test:report
```

**测试套件概览：**

| 文件 | 覆盖范围 |
|------|----------|
| `auth.spec.ts` | 登录/注册/忘记密码/权限控制/登出 |
| `student.spec.ts` | 学生仪表盘/作业/资源/AI助手/设置/分析 |
| `teacher.spec.ts` | 教师仪表盘/班级/作业/分析/行为分析/资源 |
| `teacher-intervention.spec.ts` | 干预控制台 Toggle 开关/筛选器/表单提交 |
| `student-homework.spec.ts` | 学生作业交互 + PDF/Notebook 文件上传 |
| `routing.spec.ts` | 路由重定向/404/权限守卫 |
| `mobile.spec.ts` | 移动端 viewport 适配测试 |
| `fixtures.spec.ts` | 测试文件生成验证 |

### 环境变量说明 (`.env`)

```env
# 数据库 (必须)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartlearn?schema=public"

# JWT (必须)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# SMTP 邮件 (可选)
SMTP_HOST="smtp.ethereal.email"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=""
SMTP_PASS=""

# 服务器
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"

# AI (可选，不配置则 AI 助手不可用)
AI_BASE_URL="https://api.openai.com"
AI_API_KEY=""
```

## 🔗 API 端点总览

| 前缀 | 说明 | 鉴权 |
|------|------|------|
| `/api/auth` | 认证（注册/登录/密码重置/个人资料/偏好/头像/注销） | 部分需要 |
| `/api/classes` | 班级管理 | 需要 |
| `/api/homeworks` | 作业管理 | 需要 |
| `/api/resources` | 资源中心 | 列表公开，CRUD 需教师 |
| `/api/cases` | 案例库 | 列表公开，CRUD 需教师 |
| `/api/ai` | AI 助手（聊天/历史/删除） | 需要 |
| `/api/analytics` | 数据分析 | 需要 |
| `/api/dashboard` | 仪表盘聚合 | 需要 |
| `/api/behavior` | 学生行为数据 | 需要 |
| `/api/courses` | 课程信息 | 需要 |
| `/api/health` | 健康检查 | 无 |

## ⚠️ 已知限制

- 文件上传仅支持 PDF 和 IPYNB 格式，存储在本地 `uploads/` 目录，无对象存储集成
- AI 助手需配置外部 OpenAI 兼容 API（支持自定义 `AI_BASE_URL`）
- 邮件提醒需配置 SMTP 服务

## 📦 部署

详细部署文档请参阅 [DEPLOY.md](./DEPLOY.md)

## 📄 许可证

本项目采用 [Apache License 2.0](./LICENSE) 许可证。
