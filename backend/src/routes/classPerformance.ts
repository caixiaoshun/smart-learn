import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireTeacher, requireStudent } from '../middleware/auth';

const router = Router();

type PermissionResult = { ok: true } | { ok: false; code: number; error: string };

async function ensureClassPermission(classId: string, userId: string, role: 'teacher' | 'student'): Promise<PermissionResult> {
  const classData = await prisma.class.findUnique({ where: { id: classId } });
  if (!classData) return { ok: false, code: 404, error: '班级不存在' };
  if (role === 'teacher' && classData.teacherId !== userId) return { ok: false, code: 403, error: '无权操作该班级' };
  if (role === 'student') {
    const membership = await prisma.classStudent.findUnique({ where: { studentId_classId: { studentId: userId, classId } } });
    if (!membership) return { ok: false, code: 403, error: '您不在该班级中' };
  }
  return { ok: true };
}

router.post('/record', authenticate, requireTeacher, async (req, res) => {
  try {
    const schema = z.object({
      classId: z.string().min(1),
      studentId: z.string().min(1),
      type: z.enum(['CLASSROOM_QA', 'KNOWLEDGE_SHARE']),
      topic: z.string().max(200).optional(),
      score: z.number().int().min(1).max(5).optional(),
      notes: z.string().max(1000).optional(),
      evidence: z.string().max(500).optional(),
      duration: z.number().int().min(0).optional(),
      occurredAt: z.string().datetime().optional(),
    });
    const data = schema.parse(req.body);

    const permission = await ensureClassPermission(data.classId, req.user!.userId, 'teacher');
    if (!permission.ok) return res.status(permission.code).json({ error: permission.error });

    const classMembership = await prisma.classStudent.findUnique({ where: { studentId_classId: { studentId: data.studentId, classId: data.classId } } });
    if (!classMembership) return res.status(400).json({ error: '该学生不在该班级中' });

    const record = await prisma.classPerformanceRecord.create({
      data: {
        classId: data.classId,
        studentId: data.studentId,
        recordedById: req.user!.userId,
        type: data.type,
        topic: data.topic,
        score: data.score,
        notes: data.notes,
        evidence: data.evidence,
        duration: data.duration,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      },
      include: {
        student: { select: { id: true, name: true, email: true, avatar: true } },
        recordedBy: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ message: '记录创建成功', record });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
    console.error('创建平时表现记录失败:', error);
    res.status(500).json({ error: '创建平时表现记录失败' });
  }
});

router.get('/records/:classId', authenticate, async (req, res) => {
  try {
    const { classId } = req.params;
    const { type, studentId } = req.query;

    const classData = await prisma.class.findUnique({ where: { id: classId }, include: { students: true } });
    if (!classData) return res.status(404).json({ error: '班级不存在' });

    const isTeacher = classData.teacherId === req.user!.userId;
    const isStudent = classData.students.some((s) => s.studentId === req.user!.userId);
    if (!isTeacher && !isStudent) return res.status(403).json({ error: '无权查看该班级数据' });

    const records = await prisma.classPerformanceRecord.findMany({
      where: { classId, ...(type && { type: String(type) }), ...(studentId && { studentId: String(studentId) }) },
      include: {
        student: { select: { id: true, name: true, email: true, avatar: true } },
        recordedBy: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });

    res.json({ records });
  } catch (error) {
    console.error('获取平时表现记录失败:', error);
    res.status(500).json({ error: '获取平时表现记录失败' });
  }
});

router.delete('/record/:id', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const record = await prisma.classPerformanceRecord.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ error: '记录不存在' });

    const permission = await ensureClassPermission(record.classId, req.user!.userId, 'teacher');
    if (!permission.ok) return res.status(permission.code).json({ error: permission.error });

    await prisma.classPerformanceRecord.delete({ where: { id } });
    res.json({ message: '记录删除成功' });
  } catch (error) {
    console.error('删除平时表现记录失败:', error);
    res.status(500).json({ error: '删除平时表现记录失败' });
  }
});

router.get('/summary/:classId', authenticate, async (req, res) => {
  try {
    const { classId } = req.params;
    const classWithStudents = await prisma.class.findUnique({ where: { id: classId }, include: { students: { include: { student: { select: { id: true, name: true, email: true, avatar: true } } } } } });
    if (!classWithStudents) return res.status(404).json({ error: '班级不存在' });

    const isTeacher = classWithStudents.teacherId === req.user!.userId;
    const isStudent = classWithStudents.students.some((s) => s.studentId === req.user!.userId);
    if (!isTeacher && !isStudent) return res.status(403).json({ error: '无权访问' });

    const records = await prisma.classPerformanceRecord.findMany({ where: { classId } });

    let qaWeight = 0.5;
    let shareWeight = 0.5;
    if (classWithStudents.performanceScoringRules) {
      try {
        const rules = JSON.parse(classWithStudents.performanceScoringRules);
        if (typeof rules.qaWeight === 'number') qaWeight = rules.qaWeight;
        if (typeof rules.shareWeight === 'number') shareWeight = rules.shareWeight;
      } catch { /* use defaults */ }
    }

    const summary = classWithStudents.students.map((s) => {
      const studentRecords = records.filter((r) => r.studentId === s.studentId);
      const qa = studentRecords.filter((r) => r.type === 'CLASSROOM_QA');
      const share = studentRecords.filter((r) => r.type === 'KNOWLEDGE_SHARE');
      const qaAvg = qa.length > 0 ? qa.reduce((sum, r) => sum + (r.score || 0), 0) / qa.length : 0;
      const shareAvg = share.length > 0 ? share.reduce((sum, r) => sum + (r.score || 0), 0) / share.length : 0;
      return {
        student: s.student,
        qaCount: qa.length,
        qaAvgScore: Math.round(qaAvg * 10) / 10,
        shareCount: share.length,
        shareAvgScore: Math.round(shareAvg * 10) / 10,
        totalRecords: studentRecords.length,
        compositeScore: Math.round((qaAvg * qaWeight + shareAvg * shareWeight) * 10) / 10,
      };
    });

    res.json({ summary });
  } catch (error) {
    console.error('获取平时表现汇总失败:', error);
    res.status(500).json({ error: '获取平时表现汇总失败' });
  }
});

router.get('/scoring-rules/:classId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassPermission(classId, req.user!.userId, 'teacher');
    if (!permission.ok) return res.status(permission.code).json({ error: permission.error });

    const classData = await prisma.class.findUnique({ where: { id: classId }, select: { performanceScoringRules: true } });
    const defaults = { maxScore: 5, qaWeight: 0.5, shareWeight: 0.5 };
    let rules = defaults;
    if (classData?.performanceScoringRules) {
      try { rules = { ...defaults, ...JSON.parse(classData.performanceScoringRules) }; } catch { /* use defaults */ }
    }
    res.json({ rules });
  } catch (error) {
    console.error('获取评分规则失败:', error);
    res.status(500).json({ error: '获取评分规则失败' });
  }
});

router.put('/scoring-rules/:classId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const schema = z.object({
      maxScore: z.number().int().min(1).max(100),
      qaWeight: z.number().min(0).max(1),
      shareWeight: z.number().min(0).max(1),
    }).refine((data) => Math.abs(data.qaWeight + data.shareWeight - 1) < 0.01, { message: '权重之和必须等于 1' });
    const rules = schema.parse(req.body);

    const permission = await ensureClassPermission(classId, req.user!.userId, 'teacher');
    if (!permission.ok) return res.status(permission.code).json({ error: permission.error });

    await prisma.class.update({ where: { id: classId }, data: { performanceScoringRules: JSON.stringify(rules) } });
    res.json({ message: '评分规则已更新', rules });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
    console.error('更新评分规则失败:', error);
    res.status(500).json({ error: '更新评分规则失败' });
  }
});

router.get('/export/:classId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const format = String(req.query.format || 'csv');

    const permission = await ensureClassPermission(classId, req.user!.userId, 'teacher');
    if (!permission.ok) return res.status(permission.code).json({ error: permission.error });

    const records = await prisma.classPerformanceRecord.findMany({
      where: { classId },
      include: { student: { select: { id: true, name: true, email: true } }, recordedBy: { select: { id: true, name: true } } },
      orderBy: { occurredAt: 'desc' },
    });

    if (format === 'json') return res.json({ records });

    const headers = ['学生姓名', '邮箱', '类型', '主题', '分数', '时长(分钟)', '备注', '记录时间', '记录人'];
    const rows = records.map((r) => [r.student.name, r.student.email, r.type, r.topic || '', r.score ?? '', r.duration ?? '', r.notes || '', r.occurredAt.toLocaleString('zh-CN'), r.recordedBy?.name || '']);
    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="class-performance-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

router.post('/knowledge-points', authenticate, requireTeacher, async (req, res) => {
  try {
    const schema = z.object({
      classId: z.string().min(1),
      points: z.array(z.object({ title: z.string().min(1).max(100), description: z.string().max(500).optional() })).min(1),
    });
    const { classId, points } = schema.parse(req.body);

    const permission = await ensureClassPermission(classId, req.user!.userId, 'teacher');
    if (!permission.ok) return res.status(permission.code).json({ error: permission.error });

    const created = await prisma.$transaction(points.map((p, i) => prisma.knowledgePoint.create({ data: { classId, title: p.title, description: p.description, orderIndex: i } })));
    res.status(201).json({ message: '知识点清单发布成功', knowledgePoints: created });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
    console.error('发布知识点失败:', error);
    res.status(500).json({ error: '发布知识点失败' });
  }
});

router.get('/knowledge-points/:classId', authenticate, async (req, res) => {
  try {
    const { classId } = req.params;
    const points = await prisma.knowledgePoint.findMany({ where: { classId }, include: { _count: { select: { assessments: true } } }, orderBy: { orderIndex: 'asc' } });
    res.json({ knowledgePoints: points });
  } catch (error) {
    console.error('获取知识点清单失败:', error);
    res.status(500).json({ error: '获取知识点清单失败' });
  }
});

router.post('/knowledge-assessment', authenticate, requireStudent, async (req, res) => {
  try {
    const schema = z.object({
      assessments: z.array(z.object({ knowledgePointId: z.string().min(1), masteryLevel: z.number().int().min(1).max(5), selfNote: z.string().max(500).optional() })).min(1),
    });
    const { assessments } = schema.parse(req.body);

    const results = await prisma.$transaction(
      assessments.map((a) =>
        prisma.knowledgePointAssessment.upsert({
          where: { knowledgePointId_studentId: { knowledgePointId: a.knowledgePointId, studentId: req.user!.userId } },
          update: { masteryLevel: a.masteryLevel, selfNote: a.selfNote },
          create: { knowledgePointId: a.knowledgePointId, studentId: req.user!.userId, masteryLevel: a.masteryLevel, selfNote: a.selfNote },
        })
      )
    );

    res.json({ message: '知识点自评提交成功', assessments: results });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
    console.error('提交知识点自评失败:', error);
    res.status(500).json({ error: '提交知识点自评失败' });
  }
});

router.get('/knowledge-assessment/:classId', authenticate, async (req, res) => {
  try {
    const { classId } = req.params;
    const knowledgePoints = await prisma.knowledgePoint.findMany({ where: { classId }, include: { assessments: { where: { studentId: req.user!.userId } } }, orderBy: { orderIndex: 'asc' } });
    res.json({ knowledgePoints });
  } catch (error) {
    console.error('获取知识点自评失败:', error);
    res.status(500).json({ error: '获取知识点自评失败' });
  }
});

router.get('/knowledge-distribution/:classId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassPermission(classId, req.user!.userId, 'teacher');
    if (!permission.ok) return res.status(permission.code).json({ error: permission.error });

    const points = await prisma.knowledgePoint.findMany({
      where: { classId },
      include: { assessments: { include: { student: { select: { id: true, name: true, email: true } } } } },
      orderBy: { orderIndex: 'asc' },
    });

    const distribution = points.map((kp) => {
      const levels = [0, 0, 0, 0, 0];
      for (const a of kp.assessments) levels[a.masteryLevel - 1] += 1;
      const avg = kp.assessments.length > 0 ? kp.assessments.reduce((sum, a) => sum + a.masteryLevel, 0) / kp.assessments.length : 0;
      return {
        id: kp.id,
        title: kp.title,
        description: kp.description,
        totalAssessments: kp.assessments.length,
        averageLevel: Math.round(avg * 10) / 10,
        levelDistribution: { level1: levels[0], level2: levels[1], level3: levels[2], level4: levels[3], level5: levels[4] },
        assessments: kp.assessments.map((a) => ({ student: a.student, masteryLevel: a.masteryLevel, selfNote: a.selfNote })),
      };
    });

    res.json({ distribution });
  } catch (error) {
    console.error('获取知识点分布失败:', error);
    res.status(500).json({ error: '获取知识点分布失败' });
  }
});

router.get('/knowledge-radar/:classId', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassPermission(classId, req.user!.userId, 'teacher');
    if (!permission.ok) return res.status(permission.code).json({ error: permission.error });

    const points = await prisma.knowledgePoint.findMany({ where: { classId }, include: { assessments: true }, orderBy: { orderIndex: 'asc' } });
    const radar = points.map((kp) => {
      const avg = kp.assessments.length > 0 ? kp.assessments.reduce((sum, a) => sum + a.masteryLevel, 0) / kp.assessments.length : 0;
      return { subject: kp.title, value: Math.round((avg / 5) * 100), fullMark: 100 };
    });
    res.json({ radar });
  } catch (error) {
    console.error('获取知识点雷达失败:', error);
    res.status(500).json({ error: '获取知识点雷达失败' });
  }
});

export default router;
