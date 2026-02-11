import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import { prisma } from '../index';
import { authenticate, requireTeacher, requireStudent } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { MinioStorageService } from '../services/storage/MinioStorageService';

const router = Router();
const storageService = new MinioStorageService();

function parseFiles(files: string): string[] {
  if (!files) return [];
  try {
    const parsed = JSON.parse(files);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 发布作业
router.post('/', authenticate, requireTeacher, async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().min(2, '标题至少2位').max(100, '标题最多100位'),
      description: z.string().optional().default(''),
      classId: z.string().cuid('班级ID格式不正确'),
      startTime: z.string().datetime('开始时间格式不正确'),
      deadline: z.string().datetime('截止时间格式不正确'),
      reminderHours: z.number().int().min(1).max(168).optional(), // 提前提醒小时数 (1-168小时 = 1周)
      maxScore: z.number().int().min(1).max(1000).default(100),
      allowLate: z.boolean().default(false),
      type: z.enum(['STANDARD', 'GROUP_PROJECT', 'SELF_PRACTICE']).default('STANDARD'),
      groupConfig: z.any().optional(),
      peerReviewConfig: z.any().optional(),
      selfPracticeConfig: z.any().optional(),
    });

    const { title, description, classId, startTime, deadline, reminderHours, maxScore, allowLate, type, groupConfig, peerReviewConfig, selfPracticeConfig } = schema.parse(req.body);

    // 验证班级归属
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classData) {
      return res.status(404).json({ error: '班级不存在' });
    }

    if (classData.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权向该班级发布作业' });
    }

    // 验证时间
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(deadline);
    if (end < now) {
      return res.status(400).json({ error: '截止时间不能早于当前时间' });
    }
    if (start >= end) {
      return res.status(400).json({ error: '截止时间必须晚于开始时间' });
    }

    // 计算提醒时间
    let reminderTime: Date | null = null;
    if (reminderHours) {
      reminderTime = new Date(end.getTime() - reminderHours * 60 * 60 * 1000);
    }

    const homework = await prisma.homework.create({
      data: {
        title,
        description,
        classId,
        startTime: start,
        deadline: end,
        reminderTime,
        maxScore,
        allowLate,
        type,
        groupConfig: groupConfig ? JSON.stringify(groupConfig) : null,
        peerReviewConfig: peerReviewConfig ? JSON.stringify(peerReviewConfig) : null,
        selfPracticeConfig: selfPracticeConfig ? JSON.stringify(selfPracticeConfig) : null,
      },
      include: {
        class: {
          select: { name: true },
        },
      },
    });

    res.status(201).json({
      message: '作业发布成功',
      homework,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('发布作业失败:', error);
    res.status(500).json({ error: '发布作业失败' });
  }
});

// 获取教师的作业列表
router.get('/teacher', authenticate, requireTeacher, async (req, res) => {
  try {
    const homeworks = await prisma.homework.findMany({
      where: {
        class: {
          teacherId: req.user!.userId,
        },
      },
      include: {
        class: {
          select: { id: true, name: true },
        },
        _count: {
          select: { submissions: true },
        },
        submissions: {
          include: {
            student: {
              select: { id: true, name: true, email: true, avatar: true },
            },
            group: {
              include: {
                leader: { select: { id: true, name: true, email: true, avatar: true } },
                members: {
                  include: {
                    student: { select: { id: true, name: true, email: true, avatar: true } },
                  },
                  orderBy: { joinedAt: 'asc' },
                },
              },
            },
            scoreAdjustments: true,
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = homeworks.map(hw => ({
      ...hw,
      submissions: hw.submissions.map(s => ({
        ...s,
        files: parseFiles(s.files),
      })),
    }));

    res.json({ homeworks: parsed });
  } catch (error) {
    console.error('获取作业列表失败:', error);
    res.status(500).json({ error: '获取作业列表失败' });
  }
});

// 获取学生的作业列表
router.get('/student', authenticate, requireStudent, async (req, res) => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true },
    });

    const memberships = student
      ? await prisma.classStudent.findMany({
          where: { studentId: student.id },
          select: { classId: true },
        })
      : [];

    const classIds = memberships.map(m => m.classId);

    if (classIds.length === 0) {
      return res.json({ homeworks: [] });
    }

    const homeworks = await prisma.homework.findMany({
      where: {
        classId: { in: classIds },
        startTime: { lte: new Date() },
      },
      include: {
        class: {
          select: { name: true },
        },
        submissions: {
          where: { studentId: req.user!.userId },
          select: {
            id: true,
            files: true,
            score: true,
            feedback: true,
            submittedAt: true,
            gradedAt: true,
          },
        },
      },
      orderBy: { deadline: 'asc' },
    });

    // 添加提交状态
    const homeworksWithStatus = homeworks.map(hw => {
      const sub = hw.submissions[0] || null;
      return {
        ...hw,
        isSubmitted: hw.submissions.length > 0,
        mySubmission: sub ? { ...sub, files: parseFiles(sub.files) } : null,
        isOverdue: new Date() > hw.deadline && !hw.allowLate,
      };
    });

    res.json({ homeworks: homeworksWithStatus });
  } catch (error) {
    console.error('获取作业列表失败:', error);
    res.status(500).json({ error: '获取作业列表失败' });
  }
});

// 获取作业详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const homework = await prisma.homework.findUnique({
      where: { id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            teacherId: true,
          },
        },
        submissions: {
          include: {
            student: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    // 验证权限
    const isTeacher = homework.class.teacherId === req.user!.userId;
    const isStudentInClass = await prisma.classStudent.findUnique({
      where: {
        studentId_classId: {
          studentId: req.user!.userId,
          classId: homework.classId,
        },
      },
    });

    if (!isTeacher && !isStudentInClass) {
      return res.status(403).json({ error: '无权访问此作业' });
    }

    // 学生只能看到自己的提交
    if (!isTeacher) {
      homework.submissions = homework.submissions.filter(s => s.studentId === req.user!.userId);
    }

    const parsed = {
      ...homework,
      submissions: homework.submissions.map(s => ({
        ...s,
        files: parseFiles(s.files),
      })),
    };

    res.json({ homework: parsed });
  } catch (error) {
    console.error('获取作业详情失败:', error);
    res.status(500).json({ error: '获取作业详情失败' });
  }
});

// 更新作业
router.put('/:id', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      title: z.string().min(2).max(100).optional(),
      description: z.string().max(5000).optional(),
      startTime: z.string().datetime().optional(),
      deadline: z.string().datetime().optional(),
      maxScore: z.number().int().min(1).max(1000).optional(),
      allowLate: z.boolean().optional(),
      type: z.enum(['STANDARD', 'GROUP_PROJECT', 'SELF_PRACTICE']).optional(),
      groupConfig: z.any().optional(),
      peerReviewConfig: z.any().optional(),
      selfPracticeConfig: z.any().optional(),
    });

    const data = schema.parse(req.body);

    // 验证作业归属
    const homework = await prisma.homework.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权修改此作业' });
    }

    // 验证时间逻辑
    const newStart = data.startTime ? new Date(data.startTime) : homework.startTime;
    const newEnd = data.deadline ? new Date(data.deadline) : homework.deadline;
    if (newStart >= newEnd) {
      return res.status(400).json({ error: '截止时间必须晚于开始时间' });
    }

    // 转换时间
    const updateData: Record<string, unknown> = { ...data };
    if (data.startTime) {
      updateData.startTime = new Date(data.startTime);
    }
    if (data.deadline) {
      updateData.deadline = new Date(data.deadline);
    }
    if (data.groupConfig !== undefined) {
      updateData.groupConfig = data.groupConfig ? JSON.stringify(data.groupConfig) : null;
    }
    if (data.peerReviewConfig !== undefined) {
      updateData.peerReviewConfig = data.peerReviewConfig ? JSON.stringify(data.peerReviewConfig) : null;
    }
    if (data.selfPracticeConfig !== undefined) {
      updateData.selfPracticeConfig = data.selfPracticeConfig ? JSON.stringify(data.selfPracticeConfig) : null;
    }

    const updatedHomework = await prisma.homework.update({
      where: { id },
      data: updateData,
      include: {
        class: { select: { name: true } },
      },
    });

    res.json({
      message: '作业更新成功',
      homework: updatedHomework,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('更新作业失败:', error);
    res.status(500).json({ error: '更新作业失败' });
  }
});

// 删除作业
router.delete('/:id', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    const homework = await prisma.homework.findUnique({
      where: { id },
      include: { 
        class: true,
        submissions: true,
      },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权删除此作业' });
    }

    // 删除关联的文件
    for (const submission of homework.submissions || []) {
      try {
        const parsed = JSON.parse(submission.files);
        const files = Array.isArray(parsed) ? parsed : [];
        for (const file of files) {
          if (typeof file === 'string') {
            try {
              await storageService.delete(file);
            } catch {
              console.error('删除 S3 文件失败:', file);
            }
          }
        }
      } catch {
        console.error('解析文件列表失败:', submission.files);
      }
    }

    await prisma.homework.delete({ where: { id } });

    res.json({ message: '作业删除成功' });
  } catch (error) {
    console.error('删除作业失败:', error);
    res.status(500).json({ error: '删除作业失败' });
  }
});

// 提交作业
router.post('/:id/submit', authenticate, requireStudent, upload.array('files', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请上传至少一个文件' });
    }

    // 验证作业
    const homework = await prisma.homework.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    // 验证学生是否在班级中
    const membership = await prisma.classStudent.findUnique({
      where: {
        studentId_classId: {
          studentId: req.user!.userId,
          classId: homework.classId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: '您不在该班级中' });
    }

    // 验证截止时间
    const now = new Date();
    if (now > homework.deadline && !homework.allowLate) {
      return res.status(400).json({ error: '作业已截止，不允许迟交' });
    }

    // 检查是否已提交
    const existingSubmission = await prisma.submission.findUnique({
      where: {
        studentId_homeworkId: {
          studentId: req.user!.userId,
          homeworkId: id,
        },
      },
    });

    // 删除旧文件（如果存在）
    if (existingSubmission) {
      try {
        const parsed = JSON.parse(existingSubmission.files);
        const oldFiles = Array.isArray(parsed) ? parsed : [];
        for (const f of oldFiles) {
          if (typeof f === 'string') {
            try {
              await storageService.delete(f);
            } catch {
              console.error('删除旧 S3 文件失败:', f);
            }
          }
        }
      } catch {
        console.error('解析旧文件列表失败:', existingSubmission.files);
      }
    }

    // 上传文件到 S3 并保存 key
    const uploadedKeys: string[] = [];
    for (const file of files) {
      const key = await storageService.save(file, 'homework');
      uploadedKeys.push(key);
    }

    // 创建或更新提交
    const submission = await prisma.submission.upsert({
      where: {
        studentId_homeworkId: {
          studentId: req.user!.userId,
          homeworkId: id,
        },
      },
      update: {
        files: JSON.stringify(uploadedKeys),
        submittedAt: now,
      },
      create: {
        studentId: req.user!.userId,
        homeworkId: id,
        files: JSON.stringify(uploadedKeys),
      },
    });

    res.json({
      message: '作业提交成功',
      submission: {
        id: submission.id,
        files: uploadedKeys,
        submittedAt: submission.submittedAt,
      },
    });
  } catch (error) {
    console.error('提交作业失败:', error);
    res.status(500).json({ error: '提交作业失败' });
  }
});

// 批改作业
router.post('/:id/grade/:submissionId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id, submissionId } = req.params;
    const schema = z.object({
      score: z.number().int().min(0, '分数不能为负数'),
      feedback: z.string().max(2000, '评语最多2000字').optional(),
    });

    const { score, feedback } = schema.parse(req.body);

    // 验证作业归属
    const homework = await prisma.homework.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权批改此作业' });
    }

    // 验证分数不超过满分
    if (score > homework.maxScore) {
      return res.status(400).json({ error: `分数不能超过满分 ${homework.maxScore}` });
    }

    // 获取旧分数
    const existingSubmission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { score: true, studentId: true },
    });

    if (!existingSubmission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    const existingScore = existingSubmission.score;

    // 更新提交
    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        score,
        feedback,
        gradedAt: new Date(),
      },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // 创建评分审计日志
    await prisma.scoreAuditLog.create({
      data: {
        submissionId,
        studentId: existingSubmission.studentId,
        oldScore: existingScore,
        newScore: score,
        reason: feedback || '教师评分',
        operatorId: req.user!.userId,
      },
    });

    res.json({
      message: '批改成功',
      submission,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('批改失败:', error);
    res.status(500).json({ error: '批改失败' });
  }
});

// 小组作业批改 - 给每个成员单独打分
router.post('/:id/grade-group/:submissionId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id, submissionId } = req.params;
    const schema = z.object({
      memberScores: z.array(z.object({
        studentId: z.string(),
        score: z.number().int().min(0, '分数不能为负数'),
        feedback: z.string().max(2000, '评语最多2000字').optional(),
      })).min(1, '至少需要一个成员的分数'),
    });

    const { memberScores } = schema.parse(req.body);

    // 验证作业归属
    const homework = await prisma.homework.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权批改此作业' });
    }

    if (homework.type !== 'GROUP_PROJECT') {
      return res.status(400).json({ error: '此接口仅用于小组作业批改' });
    }

    // 验证提交存在且关联小组
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        group: {
          include: {
            members: { select: { studentId: true } },
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    if (!submission.groupId || !submission.group) {
      return res.status(400).json({ error: '该提交不是小组提交' });
    }

    // 验证所有 studentId 都属于该小组
    const groupMemberIds = new Set(submission.group.members.map(m => m.studentId));
    for (const ms of memberScores) {
      if (!groupMemberIds.has(ms.studentId)) {
        return res.status(400).json({ error: `学生 ${ms.studentId} 不属于该小组` });
      }
      if (ms.score > homework.maxScore) {
        return res.status(400).json({ error: `分数不能超过满分 ${homework.maxScore}` });
      }
    }

    // 为每个成员创建/更新 ScoreAdjustment 记录
    const adjustments = [];
    for (const ms of memberScores) {
      // 获取旧的评分记录用于审计日志
      const existingAdjustment = await prisma.scoreAdjustment.findUnique({
        where: {
          submissionId_studentId: {
            submissionId,
            studentId: ms.studentId,
          },
        },
        select: { finalScore: true },
      });

      const adjustment = await prisma.scoreAdjustment.upsert({
        where: {
          submissionId_studentId: {
            submissionId,
            studentId: ms.studentId,
          },
        },
        update: {
          finalScore: ms.score,
          reason: ms.feedback || null,
        },
        create: {
          submissionId,
          studentId: ms.studentId,
          baseScore: ms.score,
          adjustScore: 0,
          finalScore: ms.score,
          reason: ms.feedback || null,
        },
      });
      adjustments.push(adjustment);

      // 创建评分审计日志
      await prisma.scoreAuditLog.create({
        data: {
          submissionId,
          studentId: ms.studentId,
          oldScore: existingAdjustment?.finalScore ?? null,
          newScore: ms.score,
          reason: ms.feedback || '教师小组成员评分',
          operatorId: req.user!.userId,
        },
      });
    }

    // 更新主提交的分数为组员平均分
    const avgScore = Math.round(memberScores.reduce((sum, ms) => sum + ms.score, 0) / memberScores.length);
    const updatedSubmission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        score: avgScore,
        feedback: '小组成员已单独评分',
        gradedAt: new Date(),
      },
      include: {
        student: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        group: {
          include: {
            leader: { select: { id: true, name: true, email: true, avatar: true } },
            members: {
              include: {
                student: { select: { id: true, name: true, email: true, avatar: true } },
              },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
        scoreAdjustments: true,
      },
    });

    res.json({
      message: '小组批改成功',
      submission: {
        ...updatedSubmission,
        files: parseFiles(updatedSubmission.files),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('小组批改失败:', error);
    res.status(500).json({ error: '小组批改失败' });
  }
});

// 下载作业文件
router.get('/:id/download/*', authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    const filename = req.params[0];

    // 验证作业
    const homework = await prisma.homework.findUnique({
      where: { id },
      include: {
        class: true,
        submissions: {
          where: {
            files: { contains: filename },
          },
          include: {
            student: { select: { id: true } },
          },
        },
      },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    // 验证权限
    const isTeacher = homework.class.teacherId === req.user!.userId;
    const isOwner = homework.submissions.some(s => s.studentId === req.user!.userId);

    if (!isTeacher && !isOwner) {
      return res.status(403).json({ error: '无权访问此文件' });
    }

    // 使用预签名 URL（1小时有效），确保文件只能由授权用户在有限时间内访问
    const signedUrl = await storageService.getSignedUrl(filename);
    res.redirect(signedUrl);
  } catch (error) {
    console.error('下载文件失败:', error);
    res.status(500).json({ error: '下载文件失败' });
  }
});

// 预览作业文件
router.get('/:id/preview/*', authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    const filename = req.params[0];

    // 验证作业
    const homework = await prisma.homework.findUnique({
      where: { id },
      include: {
        class: true,
        submissions: {
          where: {
            files: { contains: filename },
          },
        },
      },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    // 验证权限
    const isTeacher = homework.class.teacherId === req.user!.userId;
    const isOwner = homework.submissions.some(s => s.studentId === req.user!.userId);

    if (!isTeacher && !isOwner) {
      return res.status(403).json({ error: '无权访问此文件' });
    }

    const ext = path.extname(filename).toLowerCase();

    if (ext === '.pdf' || ext === '.ipynb') {
      // 使用预签名 URL（1小时有效）
      const signedUrl = await storageService.getSignedUrl(filename);
      res.redirect(signedUrl);
    } else {
      res.status(400).json({ error: '不支持的文件格式' });
    }
  } catch (error) {
    console.error('预览文件失败:', error);
    res.status(500).json({ error: '预览文件失败' });
  }
});

// 导出班级作业成绩单
router.get('/:id/export', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const format = (req.query.format as string) || 'csv'; // csv 或 json

    // 验证作业归属
    const homework = await prisma.homework.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            students: {
              include: {
                student: {
                  select: { id: true, name: true, email: true },
                },
              },
              orderBy: { student: { name: 'asc' } },
            },
          },
        },
        submissions: {
          include: {
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权导出此作业成绩' });
    }

    // 构建成绩数据
    const submissionMap = new Map(
      homework.submissions.map(s => [s.studentId, s])
    );

    const studentList = homework.class.students.map(s => s.student);

    const grades = studentList.map(student => {
      const submission = submissionMap.get(student.id);
      return {
        学号: student.id.slice(0, 8),
        姓名: student.name,
        邮箱: student.email,
        提交状态: submission ? '已提交' : '未提交',
        提交时间: submission ? submission.submittedAt.toISOString() : '-',
        分数: submission?.score ?? '-',
        评语: submission?.feedback ?? '-',
      };
    });

    if (format === 'csv') {
      // CSV 格式
      const csvHeaders = ['学号', '姓名', '邮箱', '提交状态', '提交时间', '分数', '评语'] as const;
      const csvContent = [
        csvHeaders.join(','),
        ...grades.map(row => csvHeaders.map(h => `"${row[h]}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${homework.title}_成绩单.csv"`);
      res.send('\uFEFF' + csvContent); // BOM for Excel
    } else {
      // JSON 格式
      res.json({
        homework: {
          id: homework.id,
          title: homework.title,
          maxScore: homework.maxScore,
          deadline: homework.deadline,
        },
        grades,
        statistics: {
          total: studentList.length,
          submitted: homework.submissions.length,
          notSubmitted: studentList.length - homework.submissions.length,
          submissionRate: studentList.length > 0
            ? Math.round((homework.submissions.length / studentList.length) * 100)
            : 0,
          averageScore: homework.submissions.filter(s => s.score !== null).length > 0
            ? Math.round(
                homework.submissions.filter(s => s.score !== null).reduce((a, b) => a + (b.score || 0), 0) /
                homework.submissions.filter(s => s.score !== null).length
              )
            : '-',
        },
      });
    }
  } catch (error) {
    console.error('导出成绩失败:', error);
    res.status(500).json({ error: '导出成绩失败' });
  }
});

export default router;
