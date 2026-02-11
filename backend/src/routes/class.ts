import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireTeacher, requireStudent } from '../middleware/auth';

const router = Router();

// 生成邀请码
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 创建班级
router.post('/', authenticate, requireTeacher, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2, '班级名称至少2位').max(50, '班级名称最多50位'),
      description: z.string().max(500, '描述最多500字').optional(),
    });

    const { name, description } = schema.parse(req.body);

    // 生成唯一邀请码
    let inviteCode = generateInviteCode();
    let existingClass = await prisma.class.findUnique({ where: { inviteCode } });
    while (existingClass) {
      inviteCode = generateInviteCode();
      existingClass = await prisma.class.findUnique({ where: { inviteCode } });
    }

    const newClass = await prisma.class.create({
      data: {
        name,
        description,
        inviteCode,
        teacherId: req.user!.userId,
      },
      include: {
        teacher: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { students: true },
        },
      },
    });

    res.status(201).json({
      message: '班级创建成功',
      class: newClass,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('创建班级失败:', error);
    res.status(500).json({ error: '创建班级失败' });
  }
});

// 获取教师的所有班级
router.get('/teacher', authenticate, requireTeacher, async (req, res) => {
  try {
    const classes = await prisma.class.findMany({
      where: { teacherId: req.user!.userId },
      include: {
        students: {
          include: {
            student: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { student: { name: 'asc' } },
        },
        _count: {
          select: { students: true, homeworks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ classes: classes.map(cls => ({ ...cls, students: cls.students.map(s => s.student) })) });
  } catch (error) {
    console.error('获取班级列表失败:', error);
    res.status(500).json({ error: '获取班级列表失败' });
  }
});

// 获取班级详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        teacher: {
          select: { id: true, name: true, email: true },
        },
        students: {
          include: {
            student: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { student: { name: 'asc' } },
        },
        homeworks: {
          select: {
            id: true,
            title: true,
            deadline: true,
            createdAt: true,
            _count: {
              select: { submissions: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: { students: true, homeworks: true },
        },
      },
    });

    if (!classData) {
      return res.status(404).json({ error: '班级不存在' });
    }

    // 验证权限（教师本人或班级学生）
    const isTeacher = classData.teacherId === req.user!.userId;
    const isStudent = classData.students.some(s => s.studentId === req.user!.userId);

    if (!isTeacher && !isStudent) {
      return res.status(403).json({ error: '无权访问此班级' });
    }

    res.json({
      class: {
        ...classData,
        students: classData.students.map(s => s.student),
      },
    });
  } catch (error) {
    console.error('获取班级详情失败:', error);
    res.status(500).json({ error: '获取班级详情失败' });
  }
});

// 更新班级
router.put('/:id', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(2).max(50).optional(),
      description: z.string().max(500).optional(),
    });

    const data = schema.parse(req.body);

    // 验证班级归属
    const existingClass = await prisma.class.findUnique({
      where: { id },
    });

    if (!existingClass) {
      return res.status(404).json({ error: '班级不存在' });
    }

    if (existingClass.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权修改此班级' });
    }

    const updatedClass = await prisma.class.update({
      where: { id },
      data,
      include: {
        teacher: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { students: true },
        },
      },
    });

    res.json({
      message: '班级更新成功',
      class: updatedClass,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('更新班级失败:', error);
    res.status(500).json({ error: '更新班级失败' });
  }
});

// 删除班级
router.delete('/:id', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    const existingClass = await prisma.class.findUnique({
      where: { id },
    });

    if (!existingClass) {
      return res.status(404).json({ error: '班级不存在' });
    }

    if (existingClass.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权删除此班级' });
    }

    await prisma.class.delete({ where: { id } });

    res.json({ message: '班级删除成功' });
  } catch (error) {
    console.error('删除班级失败:', error);
    res.status(500).json({ error: '删除班级失败' });
  }
});

// 学生加入班级
router.post('/join', authenticate, requireStudent, async (req, res) => {
  try {
    const schema = z.object({
      inviteCode: z.string().length(6, '邀请码为6位字符'),
    });

    const { inviteCode } = schema.parse(req.body);

    // 查找班级
    const classData = await prisma.class.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
    });

    if (!classData) {
      return res.status(404).json({ error: '邀请码无效' });
    }

    // 检查学生是否已在班级中
    const existingMembership = await prisma.classStudent.findUnique({
      where: {
        studentId_classId: {
          studentId: req.user!.userId,
          classId: classData.id,
        },
      },
    });

    if (existingMembership) {
      return res.status(400).json({ error: '您已在该班级中' });
    }

    // 加入班级
    await prisma.classStudent.create({
      data: {
        studentId: req.user!.userId,
        classId: classData.id,
      },
    });

    res.json({
      message: '加入班级成功',
      class: {
        id: classData.id,
        name: classData.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('加入班级失败:', error);
    res.status(500).json({ error: '加入班级失败' });
  }
});

// 学生退出班级
router.post('/leave', authenticate, requireStudent, async (req, res) => {
  try {
    const schema = z.object({
      classId: z.string().optional(),
    });

    const { classId } = schema.parse(req.body);

    const memberships = await prisma.classStudent.findMany({
      where: { studentId: req.user!.userId },
    });

    if (memberships.length === 0) {
      return res.status(400).json({ error: '您未加入任何班级' });
    }

    const targetClassId = classId || memberships[0].classId;

    if (!classId && memberships.length > 1) {
      return res.status(400).json({ error: '请指定要退出的班级' });
    }

    await prisma.classStudent.delete({
      where: {
        studentId_classId: {
          studentId: req.user!.userId,
          classId: targetClassId,
        },
      },
    });

    res.json({ message: '退出班级成功' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('退出班级失败:', error);
    res.status(500).json({ error: '退出班级失败' });
  }
});

// 从班级移除学生（教师操作）
router.delete('/:classId/students/:studentId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId, studentId } = req.params;

    // 验证班级归属
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classData) {
      return res.status(404).json({ error: '班级不存在' });
    }

    if (classData.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权操作此班级' });
    }

    // 验证学生是否在班级中
    const membership = await prisma.classStudent.findUnique({
      where: {
        studentId_classId: {
          studentId,
          classId,
        },
      },
    });

    if (!membership) {
      return res.status(404).json({ error: '学生不在该班级中' });
    }

    await prisma.classStudent.delete({
      where: {
        studentId_classId: {
          studentId,
          classId,
        },
      },
    });

    res.json({ message: '学生已移除' });
  } catch (error) {
    console.error('移除学生失败:', error);
    res.status(500).json({ error: '移除学生失败' });
  }
});

export default router;
