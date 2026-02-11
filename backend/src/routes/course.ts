import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

// 获取课程列表（基于用户加入的班级）
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    let classes;
    if (role === 'TEACHER') {
      classes = await prisma.class.findMany({
        where: { teacherId: userId },
        include: {
          teacher: { select: { id: true, name: true } },
          _count: { select: { students: true, homeworks: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      const memberships = await prisma.classStudent.findMany({
        where: { studentId: userId },
        include: {
          class: {
            include: {
              teacher: { select: { id: true, name: true } },
              _count: { select: { students: true, homeworks: true } },
            },
          },
        },
      });
      classes = memberships.map((m) => m.class);
    }

    const courses = classes.map((cls) => ({
      id: cls.id,
      code: cls.inviteCode,
      name: cls.name,
      description: cls.description || '',
      instructor: cls.teacher?.name || '未知',
      semester: '',
      progress: 0,
      modules: [],
    }));

    res.json({ courses });
  } catch (error) {
    console.error('获取课程列表失败:', error);
    res.status(500).json({ error: '获取课程列表失败' });
  }
});

// 获取课程详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, name: true } },
        homeworks: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            deadline: true,
          },
        },
        _count: { select: { students: true } },
      },
    });

    if (!cls) {
      return res.status(404).json({ error: '课程不存在' });
    }

    const now = new Date();

    // Generate dynamic announcements from homework data
    const announcements: { id: string; title: string; detail: string; type: 'deadline' | 'new' }[] = [];

    for (const hw of cls.homeworks) {
      const deadline = new Date(hw.deadline);
      const diffMs = deadline.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > 0 && diffDays <= 7) {
        // Upcoming deadline within 7 days
        const label = diffDays === 1 ? '明天' : `${diffDays} 天后`;
        announcements.push({
          id: `deadline-${hw.id}`,
          title: `${hw.title} 截止`,
          detail: `${label}, ${deadline.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} ${deadline.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
          type: 'deadline',
        });
      }

      const createdMs = new Date(hw.startTime).getTime();
      const createdDiffDays = Math.floor((now.getTime() - createdMs) / (1000 * 60 * 60 * 24));
      if (createdDiffDays >= 0 && createdDiffDays <= 7) {
        // Recently added within 7 days
        announcements.push({
          id: `new-${hw.id}`,
          title: '新增作业',
          detail: hw.title,
          type: 'new',
        });
      }
    }

    const course = {
      id: cls.id,
      code: cls.inviteCode,
      name: cls.name,
      description: cls.description || '',
      instructor: cls.teacher?.name || '未知',
      semester: '',
      progress: 0,
      modules: cls.homeworks.map((hw, idx) => ({
        id: hw.id,
        title: hw.title,
        description: hw.description,
        order: idx + 1,
        status: now > hw.deadline ? 'COMPLETED' : 'IN_PROGRESS',
        videos: [],
        quizzes: [],
      })),
      announcements,
    };

    res.json({ course });
  } catch (error) {
    console.error('获取课程详情失败:', error);
    res.status(500).json({ error: '获取课程详情失败' });
  }
});

// 下载课程大纲
router.get('/:id/outline', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        teacher: { select: { name: true } },
        homeworks: {
          orderBy: { createdAt: 'asc' },
          select: { title: true, description: true, deadline: true },
        },
      },
    });

    if (!cls) {
      return res.status(404).json({ error: '课程不存在' });
    }

    // Generate a plain-text outline
    let outline = `课程大纲：${cls.name}\n`;
    outline += `${'='.repeat(40)}\n\n`;
    outline += `讲师：${cls.teacher?.name || '未知'}\n`;
    if (cls.description) {
      outline += `简介：${cls.description}\n`;
    }
    outline += `\n课程内容：\n${'-'.repeat(40)}\n`;

    cls.homeworks.forEach((hw, idx) => {
      outline += `\n${idx + 1}. ${hw.title}\n`;
      outline += `   ${hw.description}\n`;
      outline += `   截止日期：${hw.deadline.toISOString().split('T')[0]}\n`;
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cls.name)}-outline.txt"`);
    res.send(outline);
  } catch (error) {
    console.error('下载课程大纲失败:', error);
    res.status(500).json({ error: '下载课程大纲失败' });
  }
});

export default router;
