import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { prisma } from './lib/prisma';

// 路由导入
import authRouter from './routes/auth';
import classRouter from './routes/class';
import homeworkRouter from './routes/homework';
import analyticsRouter from './routes/analytics';
import resourceRouter from './routes/resource';
import caseRouter from './routes/case';
import courseRouter from './routes/course';
import aiRouter from './routes/ai';
import dashboardRouter from './routes/dashboard';
import behaviorRouter from './routes/behavior';
import publicRouter from './routes/public';
import groupRouter from './routes/group';
import peerReviewRouter from './routes/peerReview';
import classPerformanceRouter from './routes/classPerformance';
import { startReminderJob } from './services/reminderService';
import { globalLimiter } from './middleware/rateLimit';

dotenv.config();

export { prisma };
const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(globalLimiter);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 路由
app.use('/api/auth', authRouter);
app.use('/api/classes', classRouter);
app.use('/api/homeworks', homeworkRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/resources', resourceRouter);
app.use('/api/cases', caseRouter);
app.use('/api/courses', courseRouter);
app.use('/api/ai', aiRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/behavior', behaviorRouter);
app.use('/api/public', publicRouter);
app.use('/api/groups', groupRouter);
app.use('/api/peer-reviews', peerReviewRouter);
app.use('/api/class-performance', classPerformanceRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动定时任务
startReminderJob();

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
