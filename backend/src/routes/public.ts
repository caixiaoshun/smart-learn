import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// 获取平台公开统计数据（无需认证）
router.get('/stats', async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    const courseCount = await prisma.class.count();

    res.json({ userCount, courseCount });
  } catch (error) {
    console.error('获取平台统计失败:', error);
    res.status(500).json({ error: '获取平台统计失败' });
  }
});

export default router;
