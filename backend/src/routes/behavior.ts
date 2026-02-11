import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireTeacher, requireStudent } from '../middleware/auth';

const router = Router();

type StudentBehaviorRow = {
  id: string;
  studentId: string;
  studentName: string;
  avatar: string | null;
  quizAvg: number;
  codingHours: number;
  discussionPosts: number;
  lastActive: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  behaviorScore: number;
};

async function buildTeacherBehaviorDataset(teacherId: string): Promise<{ students: StudentBehaviorRow[]; behaviorLogs: Array<{ studentId: string; type: string; duration: number; createdAt: Date }>; }> {
  const classes = await prisma.class.findMany({
    where: { teacherId },
    include: {
      students: {
        include: { student: { select: { id: true, name: true, avatar: true } } },
      },
      homeworks: { include: { submissions: true } },
    },
  });

  const studentMap = new Map<string, { id: string; name: string; avatar: string | null }>();
  for (const cls of classes) {
    for (const cs of cls.students) {
      if (!studentMap.has(cs.studentId)) studentMap.set(cs.studentId, cs.student);
    }
  }

  const studentIds = [...studentMap.keys()];
  if (studentIds.length === 0) return { students: [], behaviorLogs: [] };

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const behaviorLogs = await prisma.behaviorLog.findMany({
    where: {
      studentId: { in: studentIds },
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { studentId: true, type: true, duration: true, createdAt: true },
  });

  const chatCounts = await prisma.chatMessage.groupBy({
    by: ['userId'],
    where: { userId: { in: studentIds }, role: 'user' },
    _count: { id: true },
  });
  const chatCountMap = new Map(chatCounts.map((c) => [c.userId, c._count.id]));

  const students: StudentBehaviorRow[] = [];
  for (const [studentId, student] of studentMap) {
    let totalHomeworks = 0;
    let submittedCount = 0;
    let earnedScore = 0;
    let totalMaxScore = 0;

    for (const cls of classes) {
      const isInClass = cls.students.some((s) => s.studentId === studentId);
      if (!isInClass) continue;
      for (const hw of cls.homeworks) {
        totalHomeworks++;
        const submission = hw.submissions.find((s) => s.studentId === studentId);
        if (submission) {
          submittedCount++;
          earnedScore += submission.score ?? 0;
          totalMaxScore += hw.maxScore;
        }
      }
    }

    const quizAvg = totalMaxScore > 0 ? Math.round((earnedScore / totalMaxScore) * 100) : 0;
    const studentLogs = behaviorLogs.filter((l) => l.studentId === studentId);
    const codingSeconds = studentLogs
      .filter((l) => l.type === 'RESOURCE_VIEW' || l.type === 'CASE_VIEW')
      .reduce((sum, l) => sum + l.duration, 0);
    const codingHours = Math.round((codingSeconds / 3600) * 10) / 10;
    const discussionPosts = chatCountMap.get(studentId) ?? 0;

    const lastLog = [...studentLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const lastActive = lastLog ? formatRelativeTime(lastLog.createdAt) : '无记录';

    const submissionRate = totalHomeworks > 0 ? submittedCount / totalHomeworks : 0;
    const aiScore = Math.min(1, Math.log2(discussionPosts + 1) / Math.log2(50));
    const codingScore = Math.min(1, codingHours / 8);
    const behaviorScoreRaw = submissionRate * 55 + aiScore * 25 + codingScore * 20;
    const behaviorScore = Math.round(behaviorScoreRaw * 100) / 100;

    let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    if (behaviorScore < 50) riskLevel = 'HIGH';
    else if (behaviorScore < 80) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    students.push({
      id: studentId,
      studentId,
      studentName: student.name,
      avatar: student.avatar,
      quizAvg,
      codingHours,
      discussionPosts,
      lastActive,
      riskLevel,
      behaviorScore,
    });
  }

  return { students, behaviorLogs };
}

function buildBehaviorOverview(students: StudentBehaviorRow[], behaviorLogs: Array<{ studentId: string; type: string; duration: number; createdAt: Date }>) {
  const totalStudents = students.length;
  const highRiskCount = students.filter((s) => s.riskLevel === 'HIGH').length;
  const mediumRiskCount = students.filter((s) => s.riskLevel === 'MEDIUM').length;
  const lowRiskCount = students.filter((s) => s.riskLevel === 'LOW').length;
  const avgBehaviorScore = totalStudents > 0 ? Math.round((students.reduce((sum, s) => sum + s.behaviorScore, 0) / totalStudents) * 100) / 100 : 0;

  const now = new Date();
  const labels: string[] = [];
  const trendMap = new Map<string, number>();
  for (let i = 9; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    labels.push(label);
    trendMap.set(label, 0);
  }

  for (const log of behaviorLogs) {
    const d = new Date(log.createdAt);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    if (trendMap.has(label)) trendMap.set(label, (trendMap.get(label) || 0) + log.duration);
  }

  const maxVal = Math.max(...trendMap.values(), 1);
  const activityTrend = labels.map((label) => ({ name: label, value: Math.round(((trendMap.get(label) || 0) / maxVal) * 100) }));

  const avgQuiz = totalStudents > 0 ? Math.round(students.reduce((sum, s) => sum + s.quizAvg, 0) / totalStudents) : 0;
  const avgCoding = totalStudents > 0 ? Math.round((students.reduce((sum, s) => sum + s.codingHours, 0) / totalStudents) * 10) / 10 : 0;
  const avgDiscussion = totalStudents > 0 ? Math.round(students.reduce((sum, s) => sum + s.discussionPosts, 0) / totalStudents) : 0;

  const abilityRadar = [
    { subject: '编程', value: Math.min(100, Math.round(avgCoding * 10)), fullMark: 100 },
    { subject: '协作', value: Math.min(100, avgDiscussion * 5), fullMark: 100 },
    { subject: '逻辑', value: avgQuiz, fullMark: 100 },
    { subject: '表达', value: Math.min(100, Math.round((avgQuiz + Math.min(100, avgDiscussion * 5)) / 2)), fullMark: 100 },
    { subject: '活跃', value: Math.min(100, Math.round((avgBehaviorScore + Math.min(100, avgDiscussion * 5)) / 2)), fullMark: 100 },
  ];

  return {
    summary: {
      totalStudents,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      avgBehaviorScore,
      updatedAt: new Date().toISOString(),
    },
    activityTrend,
    abilityRadar,
  };
}

// 记录学生行为日志（学生）
router.post('/', authenticate, requireStudent, async (req, res) => {
  try {
    const schema = z.object({
      type: z.enum(['PAGE_VIEW', 'RESOURCE_VIEW', 'CASE_VIEW', 'HOMEWORK_SUBMIT', 'AI_CHAT']),
      duration: z.number().int().min(0).default(0),
      metadata: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const log = await prisma.behaviorLog.create({
      data: {
        studentId: req.user!.userId,
        type: data.type,
        duration: data.duration,
        metadata: data.metadata,
      },
    });

    res.status(201).json({ message: '行为记录成功', log });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('记录行为日志失败:', error);
    res.status(500).json({ error: '记录行为日志失败' });
  }
});

router.get('/my', authenticate, requireStudent, async (req, res) => {
  try {
    const { type, page = '1', limit = '20' } = req.query;
    const where: Record<string, unknown> = { studentId: req.user!.userId };
    if (type) where.type = String(type);
    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));
    const skip = (pageNum - 1) * limitNum;
    const [logs, total] = await Promise.all([
      prisma.behaviorLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limitNum }),
      prisma.behaviorLog.count({ where }),
    ]);

    res.json({ logs, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('获取行为日志失败:', error);
    res.status(500).json({ error: '获取行为日志失败' });
  }
});

// 获取教师所有学生行为列表
router.get('/teacher/students', authenticate, requireTeacher, async (req, res) => {
  try {
    const { students } = await buildTeacherBehaviorDataset(req.user!.userId);
    res.json({ students });
  } catch (error) {
    console.error('获取学生行为数据失败:', error);
    res.status(500).json({ error: '获取学生行为数据失败' });
  }
});

// 获取教师行为分析总览（图表/统计全部来自后端）
router.get('/teacher/overview', authenticate, requireTeacher, async (req, res) => {
  try {
    const { students, behaviorLogs } = await buildTeacherBehaviorDataset(req.user!.userId);
    const overview = buildBehaviorOverview(students, behaviorLogs);
    res.json({ ...overview, students });
  } catch (error) {
    console.error('获取行为分析总览失败:', error);
    res.status(500).json({ error: '获取行为分析总览失败' });
  }
});

// 实时预警通知
router.get('/teacher/realtime-alerts', authenticate, requireTeacher, async (req, res) => {
  try {
    const { students } = await buildTeacherBehaviorDataset(req.user!.userId);
    const highRisk = students
      .filter((s) => s.riskLevel === 'HIGH' || s.behaviorScore < 45)
      .sort((a, b) => a.behaviorScore - b.behaviorScore)
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        studentId: s.studentId,
        studentName: s.studentName,
        avatar: s.avatar,
        riskLevel: s.riskLevel,
        behaviorScore: s.behaviorScore,
        message: `行为分 ${s.behaviorScore.toFixed(1)}，建议尽快干预`,
        triggeredAt: new Date().toISOString(),
      }));

    res.json({ alerts: highRisk });
  } catch (error) {
    console.error('获取实时预警失败:', error);
    res.status(500).json({ error: '获取实时预警失败' });
  }
});

// 干预历史时间线
router.get('/teacher/interventions/history', authenticate, requireTeacher, async (req, res) => {
  try {
    const list = await prisma.intervention.findMany({
      where: { teacherId: req.user!.userId },
      include: { student: { select: { id: true, name: true, avatar: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const history = list.map((it) => ({
      id: it.id,
      studentId: it.studentId,
      studentName: it.student.name,
      avatar: it.student.avatar,
      email: it.student.email,
      type: it.type,
      status: it.status,
      priority: it.priority,
      description: it.description,
      createdAt: it.createdAt,
      resolvedAt: it.resolvedAt,
    }));

    res.json({ history });
  } catch (error) {
    console.error('获取干预历史失败:', error);
    res.status(500).json({ error: '获取干预历史失败' });
  }
});

// 一键发送提醒（站内干预记录 + 行为日志）
router.post('/teacher/interventions/:studentId/remind', authenticate, requireTeacher, async (req, res) => {
  try {
    const { studentId } = req.params;
    const schema = z.object({ message: z.string().min(2).max(500) });
    const { message } = schema.parse(req.body);

    const classes = await prisma.class.findMany({
      where: { teacherId: req.user!.userId },
      include: { students: true },
    });
    const inTeacherClass = classes.some((cls) => cls.students.some((s) => s.studentId === studentId));
    if (!inTeacherClass) return res.status(403).json({ error: '该学生不在您的授课班级中' });

    const intervention = await prisma.intervention.create({
      data: {
        studentId,
        teacherId: req.user!.userId,
        type: 'ENGAGEMENT_WARNING',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        description: message,
        aiRecommendation: '已发送提醒，请在48小时后复查行为分变化。',
      },
    });

    await prisma.behaviorLog.create({
      data: {
        studentId,
        type: 'PAGE_VIEW',
        duration: 0,
        metadata: JSON.stringify({ source: 'teacher_reminder', interventionId: intervention.id, message }),
      },
    });

    res.status(201).json({ message: '提醒发送成功', interventionId: intervention.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('发送提醒失败:', error);
    res.status(500).json({ error: '发送提醒失败' });
  }
});

// 导出行为分析报表
router.get('/teacher/export', authenticate, requireTeacher, async (req, res) => {
  try {
    const format = String(req.query.format || 'csv');
    const { students, behaviorLogs } = await buildTeacherBehaviorDataset(req.user!.userId);
    const overview = buildBehaviorOverview(students, behaviorLogs);

    if (format === 'json') {
      return res.json({ ...overview, students });
    }

    const headers = ['学生姓名', '学号', '测验均分', '编程时长(小时)', '讨论次数', '行为分', '风险等级', '最近活跃'];
    const rows = students.map((s) => [s.studentName, s.studentId, s.quizAvg, s.codingHours, s.discussionPosts, s.behaviorScore, s.riskLevel, s.lastActive]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="behavior-report-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('导出行为报表失败:', error);
    res.status(500).json({ error: '导出行为报表失败' });
  }
});

router.get('/stats/:studentId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { studentId } = req.params;
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const typeStats = await prisma.behaviorLog.groupBy({
      by: ['type'],
      where: { studentId, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
      _sum: { duration: true },
    });

    const logs = await prisma.behaviorLog.findMany({
      where: { studentId, createdAt: { gte: thirtyDaysAgo } },
      select: { duration: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dailyMap: Record<string, number> = {};
    for (const log of logs) {
      const day = new Date(log.createdAt).toISOString().slice(0, 10);
      dailyMap[day] = (dailyMap[day] ?? 0) + log.duration;
    }

    const dailyStats = Object.entries(dailyMap).map(([date, totalDuration]) => ({ date, totalDuration }));
    res.json({ typeStats, dailyStats });
  } catch (error) {
    console.error('获取学生行为统计失败:', error);
    res.status(500).json({ error: '获取学生行为统计失败' });
  }
});

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return new Date(date).toLocaleDateString('zh-CN');
}

export default router;
