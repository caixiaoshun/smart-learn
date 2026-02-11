import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireTeacher, requireStudent } from '../middleware/auth';

const router = Router();

// ========== 自评 ==========

// 提交自评
router.post('/self-assessment', authenticate, requireStudent, async (req, res) => {
  try {
    const schema = z.object({
      homeworkId: z.string().min(1),
      score: z.number().int().min(0),
      description: z.string().min(1, '自评说明不能为空').max(2000),
    });
    const { homeworkId, score, description } = schema.parse(req.body);

    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.type !== 'GROUP_PROJECT') {
      return res.status(400).json({ error: '仅项目小组作业支持自评' });
    }

    if (score > homework.maxScore) {
      return res.status(400).json({ error: `自评分不能超过满分 ${homework.maxScore}` });
    }

    const assessment = await prisma.selfAssessment.upsert({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId: req.user!.userId,
        },
      },
      update: { score, description },
      create: {
        homeworkId,
        studentId: req.user!.userId,
        score,
        description,
      },
    });

    res.json({ message: '自评提交成功', assessment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('提交自评失败:', error);
    res.status(500).json({ error: '提交自评失败' });
  }
});

// 获取自评
router.get('/self-assessment/:homeworkId', authenticate, async (req, res) => {
  try {
    const { homeworkId } = req.params;

    const assessment = await prisma.selfAssessment.findUnique({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId: req.user!.userId,
        },
      },
    });

    res.json({ assessment });
  } catch (error) {
    console.error('获取自评失败:', error);
    res.status(500).json({ error: '获取自评失败' });
  }
});

// 教师查看全部自评
router.get('/self-assessments/:homeworkId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { homeworkId } = req.params;

    const assessments = await prisma.selfAssessment.findMany({
      where: { homeworkId },
      include: {
        student: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ assessments });
  } catch (error) {
    console.error('获取自评列表失败:', error);
    res.status(500).json({ error: '获取自评列表失败' });
  }
});

// ========== 互评分配 ==========

// 教师触发互评分配
router.post('/assign/:homeworkId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { homeworkId } = req.params;

    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: {
        class: true,
        submissions: {
          include: { group: { include: { members: true } } },
        },
      },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.type !== 'GROUP_PROJECT') {
      return res.status(400).json({ error: '仅项目小组作业支持互评' });
    }

    if (homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权操作' });
    }

    const submissions = homework.submissions;
    if (submissions.length < 2) {
      return res.status(400).json({ error: '至少需要2个提交才能分配互评' });
    }

    const peerReviewConfig = homework.peerReviewConfig ? JSON.parse(homework.peerReviewConfig) : {};
    const reviewersPerSubmission = peerReviewConfig.reviewersPerSubmission || 3;
    const reviewDeadline = peerReviewConfig.reviewDeadline
      ? new Date(peerReviewConfig.reviewDeadline)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 默认7天

    // 删除已有分配（重新分配）
    await prisma.peerReviewAssignment.deleteMany({
      where: { homeworkId },
    });

    // 收集所有评审者（班级内所有学生）
    const classStudents = await prisma.classStudent.findMany({
      where: { classId: homework.classId },
      select: { studentId: true },
    });
    const allStudentIds = classStudents.map(cs => cs.studentId);

    // 分配逻辑：每个提交分配 N 个评审者，避免自评（同组不互评）
    const assignments: { reviewerId: string; submissionId: string }[] = [];

    for (const submission of submissions) {
      // 获取该提交的组员ID（排除自评/同组互评）
      const groupMemberIds = submission.group?.members.map(m => m.studentId) || [submission.studentId];

      // 可选评审者 = 所有学生 - 同组成员
      const eligibleReviewers = allStudentIds.filter(id => !groupMemberIds.includes(id));

      // 随机选取 N 个评审者 (Fisher-Yates shuffle)
      const shuffled = [...eligibleReviewers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const selected = shuffled.slice(0, Math.min(reviewersPerSubmission, shuffled.length));

      for (const reviewerId of selected) {
        assignments.push({ reviewerId, submissionId: submission.id });
      }
    }

    // 批量创建分配
    if (assignments.length > 0) {
      await prisma.peerReviewAssignment.createMany({
        data: assignments.map(a => ({
          homeworkId,
          reviewerId: a.reviewerId,
          submissionId: a.submissionId,
          deadline: reviewDeadline,
        })),
        skipDuplicates: true,
      });
    }

    res.json({
      message: '互评分配成功',
      totalAssignments: assignments.length,
      reviewersPerSubmission,
      reviewDeadline,
    });
  } catch (error) {
    console.error('互评分配失败:', error);
    res.status(500).json({ error: '互评分配失败' });
  }
});

// ========== 互评提交 ==========

// 获取学生的待评审任务
router.get('/my-tasks', authenticate, requireStudent, async (req, res) => {
  try {
    const tasks = await prisma.peerReviewAssignment.findMany({
      where: { reviewerId: req.user!.userId },
      include: {
        homework: { select: { id: true, title: true, maxScore: true, deadline: true } },
        submission: {
          select: {
            id: true,
            files: true,
            laborDivision: true,
            submittedAt: true,
            // 双向匿名：不返回学生信息
          },
        },
      },
      orderBy: { deadline: 'asc' },
    });

    // 处理文件JSON
    const parsed = tasks.map(t => ({
      ...t,
      submission: {
        ...t.submission,
        files: t.submission.files ? JSON.parse(t.submission.files) : [],
        laborDivision: t.submission.laborDivision ? JSON.parse(t.submission.laborDivision) : null,
      },
    }));

    res.json({ tasks: parsed });
  } catch (error) {
    console.error('获取评审任务失败:', error);
    res.status(500).json({ error: '获取评审任务失败' });
  }
});

// 提交互评
router.post('/review', authenticate, requireStudent, async (req, res) => {
  try {
    const schema = z.object({
      homeworkId: z.string().min(1),
      submissionId: z.string().min(1),
      score: z.number().int().min(0),
      comment: z.string().max(2000).optional(),
    });
    const { homeworkId, submissionId, score, comment } = schema.parse(req.body);

    // 验证有评审任务
    const assignment = await prisma.peerReviewAssignment.findUnique({
      where: {
        reviewerId_submissionId: {
          reviewerId: req.user!.userId,
          submissionId,
        },
      },
      include: { homework: true },
    });

    if (!assignment) {
      return res.status(403).json({ error: '您没有该提交的评审任务' });
    }

    if (score > assignment.homework.maxScore) {
      return res.status(400).json({ error: `评分不能超过满分 ${assignment.homework.maxScore}` });
    }

    // 计算匿名标签（仅在首次创建时设置，更新时保留原标签）
    const existingReview = await prisma.peerReview.findUnique({
      where: {
        reviewerId_submissionId: {
          reviewerId: req.user!.userId,
          submissionId,
        },
      },
    });

    let anonymousLabel: string;
    if (existingReview) {
      anonymousLabel = existingReview.anonymousLabel || `评审员#${existingReview.id.slice(-4)}`;
    } else {
      const reviewCount = await prisma.peerReview.count({ where: { submissionId } });
      anonymousLabel = `评审员#${reviewCount + 1}`;
    }

    // 创建互评记录
    const review = await prisma.peerReview.upsert({
      where: {
        reviewerId_submissionId: {
          reviewerId: req.user!.userId,
          submissionId,
        },
      },
      update: { score, comment },
      create: {
        homeworkId,
        reviewerId: req.user!.userId,
        submissionId,
        score,
        comment,
        anonymousLabel,
      },
    });

    // 更新分配状态
    await prisma.peerReviewAssignment.update({
      where: {
        reviewerId_submissionId: {
          reviewerId: req.user!.userId,
          submissionId,
        },
      },
      data: { status: 'COMPLETED' },
    });

    res.json({ message: '互评提交成功', review });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('提交互评失败:', error);
    res.status(500).json({ error: '提交互评失败' });
  }
});

// 获取提交的互评结果（匿名展示）
router.get('/reviews/:submissionId', authenticate, async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { homework: { include: { class: true } } },
    });

    if (!submission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    const isTeacher = submission.homework.class.teacherId === req.user!.userId;

    const reviews = await prisma.peerReview.findMany({
      where: { submissionId },
      include: isTeacher
        ? { reviewer: { select: { id: true, name: true, email: true } } }
        : undefined,
      orderBy: { createdAt: 'asc' },
    });

    // 学生端隐藏评审者真实身份（双向匿名）
    const result = reviews.map((r, index) => ({
      id: r.id,
      score: r.score,
      comment: r.comment,
      anonymousLabel: r.anonymousLabel || `评审员#${index + 1}`,
      flag: r.flag,
      createdAt: r.createdAt,
      // 教师可见真实身份
      ...(isTeacher ? { reviewer: (r as any).reviewer } : {}),
    }));

    res.json({ reviews: result });
  } catch (error) {
    console.error('获取互评结果失败:', error);
    res.status(500).json({ error: '获取互评结果失败' });
  }
});

// 教师仲裁异常评分
router.post('/reviews/:reviewId/flag', authenticate, requireTeacher, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const schema = z.object({
      flag: z.enum(['NORMAL', 'FLAGGED', 'ARBITRATED']),
    });
    const { flag } = schema.parse(req.body);

    const review = await prisma.peerReview.update({
      where: { id: reviewId },
      data: { flag },
    });

    res.json({ message: '标记更新成功', review });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('标记更新失败:', error);
    res.status(500).json({ error: '标记更新失败' });
  }
});

// 教师补充分配互评（覆盖率保障）
router.post('/supplement/:homeworkId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { homeworkId } = req.params;

    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: {
        class: true,
        submissions: true,
      },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权操作' });
    }

    // 找出缺评的提交
    const peerReviewConfig = homework.peerReviewConfig ? JSON.parse(homework.peerReviewConfig) : {};
    const minReviews = peerReviewConfig.reviewersPerSubmission || 3;

    const submissionsWithCounts = await prisma.submission.findMany({
      where: { homeworkId },
      include: {
        _count: { select: { peerReviewAssignments: true } },
      },
    });

    const underReviewed = submissionsWithCounts.filter(
      s => s._count.peerReviewAssignments < minReviews
    );

    if (underReviewed.length === 0) {
      return res.json({ message: '所有提交已有足够评审', supplemented: 0 });
    }

    // 获取可用评审者
    const classStudents = await prisma.classStudent.findMany({
      where: { classId: homework.classId },
      select: { studentId: true },
    });
    const allStudentIds = classStudents.map(cs => cs.studentId);

    const peerReviewDeadline = peerReviewConfig.reviewDeadline
      ? new Date(peerReviewConfig.reviewDeadline)
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    let supplemented = 0;
    for (const sub of underReviewed) {
      const needed = minReviews - sub._count.peerReviewAssignments;

      // 已分配的评审者
      const existingAssignments = await prisma.peerReviewAssignment.findMany({
        where: { submissionId: sub.id },
        select: { reviewerId: true },
      });
      const assignedIds = new Set(existingAssignments.map(a => a.reviewerId));
      assignedIds.add(sub.studentId); // 排除提交者自己

      const eligible = allStudentIds.filter(id => !assignedIds.has(id));
      const shuffled = [...eligible];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const selected = shuffled.slice(0, Math.min(needed, shuffled.length));

      if (selected.length > 0) {
        await prisma.peerReviewAssignment.createMany({
          data: selected.map(reviewerId => ({
            homeworkId,
            reviewerId,
            submissionId: sub.id,
            deadline: peerReviewDeadline,
          })),
          skipDuplicates: true,
        });
        supplemented += selected.length;
      }
    }

    res.json({ message: '补充分配成功', supplemented });
  } catch (error) {
    console.error('补充分配失败:', error);
    res.status(500).json({ error: '补充分配失败' });
  }
});

export default router;
