import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireTeacher, requireStudent } from '../middleware/auth';

const router = Router();

// 获取作业的小组列表
router.get('/homework/:homeworkId', authenticate, async (req, res) => {
  try {
    const { homeworkId } = req.params;

    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: { class: true },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.type !== 'GROUP_PROJECT') {
      return res.status(400).json({ error: '此作业不是项目小组作业' });
    }

    const groups = await prisma.assignmentGroup.findMany({
      where: { homeworkId },
      include: {
        leader: { select: { id: true, name: true, email: true, avatar: true } },
        members: {
          include: {
            student: { select: { id: true, name: true, email: true, avatar: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const classStudents = await prisma.classStudent.findMany({
      where: { classId: homework.classId },
      include: {
        student: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });

    const assignedStudentIds = new Set(
      groups.flatMap((group) => group.members.map((member) => member.studentId))
    );

    const unassignedStudents = classStudents
      .map((entry) => entry.student)
      .filter((student) => !assignedStudentIds.has(student.id));

    const groupConfig = homework.groupConfig ? JSON.parse(homework.groupConfig) : {};

    res.json({ groups, unassignedStudents, groupConfig });
  } catch (error) {
    console.error('获取小组列表失败:', error);
    res.status(500).json({ error: '获取小组列表失败' });
  }
});

// 教师自动分组
router.post('/homework/:homeworkId/auto-assign', authenticate, requireTeacher, async (req, res) => {
  try {
    const { homeworkId } = req.params;
    const schema = z.object({
      preferredSize: z.number().int().min(2).max(10).optional(),
    });
    const { preferredSize } = schema.parse(req.body || {});

    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: { class: true },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权操作此作业' });
    }

    if (homework.type !== 'GROUP_PROJECT') {
      return res.status(400).json({ error: '此作业不是项目小组作业' });
    }

    const groupConfig = homework.groupConfig ? JSON.parse(homework.groupConfig) : {};
    const minSize = Number(groupConfig.minSize) || 2;
    const maxSize = Number(groupConfig.maxSize) || 6;
    const targetSize = Math.min(maxSize, Math.max(minSize, preferredSize || maxSize));

    const classStudents = await prisma.classStudent.findMany({
      where: { classId: homework.classId },
      select: {
        student: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const existingGroups = await prisma.assignmentGroup.findMany({
      where: { homeworkId },
      include: { members: true },
      orderBy: { createdAt: 'asc' },
    });

    const assignedStudentIds = new Set(
      existingGroups.flatMap((group) => group.members.map((member) => member.studentId))
    );
    const unassignedStudents = classStudents
      .map((entry) => entry.student)
      .filter((student) => !assignedStudentIds.has(student.id));

    if (unassignedStudents.length === 0) {
      return res.json({ message: '所有学生均已分组', assignedCount: 0 });
    }

    let groupCursor = 0;
    const groupsToUse = [...existingGroups];
    for (const student of unassignedStudents) {
      let chosenGroup = groupsToUse[groupCursor];
      if (!chosenGroup || chosenGroup.members.length >= targetSize) {
        const groupIndex = groupsToUse.length + 1;
        chosenGroup = await prisma.assignmentGroup.create({
          data: {
            homeworkId,
            name: `第${groupIndex}组`,
            leaderId: student.id,
            members: {
              create: {
                studentId: student.id,
                role: 'LEADER',
              },
            },
          },
          include: { members: true },
        });
        groupsToUse.push(chosenGroup);
        groupCursor = groupsToUse.length - 1;
        continue;
      }

      await prisma.assignmentGroupMember.create({
        data: {
          groupId: chosenGroup.id,
          studentId: student.id,
          role: 'MEMBER',
        },
      });
      chosenGroup.members.push({
        id: '',
        groupId: chosenGroup.id,
        studentId: student.id,
        role: 'MEMBER',
        joinedAt: new Date(),
      });

      if (chosenGroup.members.length >= targetSize) {
        groupCursor += 1;
      }
    }

    res.json({
      message: `自动分组完成，已分配 ${unassignedStudents.length} 名学生`,
      assignedCount: unassignedStudents.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('自动分组失败:', error);
    res.status(500).json({ error: '自动分组失败' });
  }
});

// 创建小组（学生自由组队）
router.post('/homework/:homeworkId', authenticate, requireStudent, async (req, res) => {
  try {
    const { homeworkId } = req.params;
    const schema = z.object({
      name: z.string().min(1, '小组名称不能为空').max(50, '小组名称最多50字'),
    });
    const { name } = schema.parse(req.body);

    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: { class: true },
    });

    if (!homework) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (homework.type !== 'GROUP_PROJECT') {
      return res.status(400).json({ error: '此作业不是项目小组作业' });
    }

    // 验证学生在班级中
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

    // 检查组队截止时间
    const groupConfig = homework.groupConfig ? JSON.parse(homework.groupConfig) : {};
    if (groupConfig.groupDeadline && new Date() > new Date(groupConfig.groupDeadline)) {
      return res.status(400).json({ error: '组队已截止' });
    }

    // 检查学生是否已在其他小组
    const existingMembership = await prisma.assignmentGroupMember.findFirst({
      where: {
        studentId: req.user!.userId,
        group: { homeworkId },
      },
    });

    if (existingMembership) {
      return res.status(400).json({ error: '您已在该作业的一个小组中' });
    }

    // 创建小组并添加组长为成员
    const group = await prisma.assignmentGroup.create({
      data: {
        homeworkId,
        name,
        leaderId: req.user!.userId,
        members: {
          create: {
            studentId: req.user!.userId,
            role: 'LEADER',
          },
        },
      },
      include: {
        leader: { select: { id: true, name: true, email: true, avatar: true } },
        members: {
          include: {
            student: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
    });

    res.status(201).json({ message: '小组创建成功', group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('创建小组失败:', error);
    res.status(500).json({ error: '创建小组失败' });
  }
});

// 加入小组
router.post('/:groupId/join', authenticate, requireStudent, async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await prisma.assignmentGroup.findUnique({
      where: { id: groupId },
      include: {
        homework: { include: { class: true } },
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      return res.status(404).json({ error: '小组不存在' });
    }

    if (group.status !== 'FORMING') {
      return res.status(400).json({ error: '小组已锁定，无法加入' });
    }

    // 验证学生在班级中
    const membership = await prisma.classStudent.findUnique({
      where: {
        studentId_classId: {
          studentId: req.user!.userId,
          classId: group.homework.classId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: '您不在该班级中' });
    }

    // 检查人数上限
    const groupConfig = group.homework.groupConfig ? JSON.parse(group.homework.groupConfig) : {};
    const maxSize = groupConfig.maxSize || 6;
    if (group._count.members >= maxSize) {
      return res.status(400).json({ error: '小组人数已满' });
    }

    // 检查是否已在其他小组
    const existingMembership = await prisma.assignmentGroupMember.findFirst({
      where: {
        studentId: req.user!.userId,
        group: { homeworkId: group.homeworkId },
      },
    });

    if (existingMembership) {
      return res.status(400).json({ error: '您已在该作业的一个小组中' });
    }

    const member = await prisma.assignmentGroupMember.create({
      data: {
        groupId,
        studentId: req.user!.userId,
        role: 'MEMBER',
      },
      include: {
        student: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    res.json({ message: '加入小组成功', member });
  } catch (error) {
    console.error('加入小组失败:', error);
    res.status(500).json({ error: '加入小组失败' });
  }
});

// 退出小组
router.post('/:groupId/leave', authenticate, requireStudent, async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await prisma.assignmentGroup.findUnique({
      where: { id: groupId },
      include: { homework: true },
    });

    if (!group) {
      return res.status(404).json({ error: '小组不存在' });
    }

    if (group.status !== 'FORMING') {
      return res.status(400).json({ error: '小组已锁定，无法退出' });
    }

    // 检查组队配置是否允许退组
    const groupConfig = group.homework.groupConfig ? JSON.parse(group.homework.groupConfig) : {};
    if (groupConfig.allowSwitch === false) {
      return res.status(400).json({ error: '此作业不允许退出小组' });
    }

    const member = await prisma.assignmentGroupMember.findFirst({
      where: { groupId, studentId: req.user!.userId },
    });

    if (!member) {
      return res.status(404).json({ error: '您不在该小组中' });
    }

    // 如果是组长退出，需要转让或解散
    if (group.leaderId === req.user!.userId) {
      const otherMembers = await prisma.assignmentGroupMember.findMany({
        where: { groupId, studentId: { not: req.user!.userId } },
        orderBy: { joinedAt: 'asc' },
      });

      if (otherMembers.length === 0) {
        // 最后一人，解散小组
        await prisma.assignmentGroup.delete({ where: { id: groupId } });
        return res.json({ message: '小组已解散' });
      }

      // 转让组长给最早加入的成员
      const newLeader = otherMembers[0];
      await prisma.assignmentGroup.update({
        where: { id: groupId },
        data: { leaderId: newLeader.studentId },
      });
      await prisma.assignmentGroupMember.update({
        where: { id: newLeader.id },
        data: { role: 'LEADER' },
      });
    }

    await prisma.assignmentGroupMember.delete({ where: { id: member.id } });

    res.json({ message: '已退出小组' });
  } catch (error) {
    console.error('退出小组失败:', error);
    res.status(500).json({ error: '退出小组失败' });
  }
});

// 教师锁定小组
router.post('/:groupId/lock', authenticate, requireTeacher, async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await prisma.assignmentGroup.findUnique({
      where: { id: groupId },
      include: { homework: { include: { class: true } } },
    });

    if (!group) {
      return res.status(404).json({ error: '小组不存在' });
    }

    if (group.homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权操作此小组' });
    }

    const updated = await prisma.assignmentGroup.update({
      where: { id: groupId },
      data: { status: 'LOCKED' },
    });

    res.json({ message: '小组已锁定', group: updated });
  } catch (error) {
    console.error('锁定小组失败:', error);
    res.status(500).json({ error: '锁定小组失败' });
  }
});

// 教师指派学生到小组
router.post('/:groupId/assign', authenticate, requireTeacher, async (req, res) => {
  try {
    const { groupId } = req.params;
    const schema = z.object({
      studentId: z.string().min(1, '学生ID不能为空'),
    });
    const { studentId } = schema.parse(req.body);

    const group = await prisma.assignmentGroup.findUnique({
      where: { id: groupId },
      include: {
        homework: { include: { class: true } },
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      return res.status(404).json({ error: '小组不存在' });
    }

    if (group.homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权操作此小组' });
    }

    // 检查学生是否在班级中
    const classMembership = await prisma.classStudent.findUnique({
      where: {
        studentId_classId: {
          studentId,
          classId: group.homework.classId,
        },
      },
    });

    if (!classMembership) {
      return res.status(400).json({ error: '该学生不在该班级中' });
    }

    // 检查是否已在其他小组
    const existingMembership = await prisma.assignmentGroupMember.findFirst({
      where: {
        studentId,
        group: { homeworkId: group.homeworkId },
      },
    });

    if (existingMembership) {
      return res.status(400).json({ error: '该学生已在其他小组中' });
    }

    const member = await prisma.assignmentGroupMember.create({
      data: {
        groupId,
        studentId,
        role: 'MEMBER',
      },
      include: {
        student: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    res.json({ message: '指派成功', member });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('指派学生失败:', error);
    res.status(500).json({ error: '指派学生失败' });
  }
});

// 提交项目小组作业（组长提交，含分工说明）
router.post('/:groupId/submit', authenticate, requireStudent, async (req, res) => {
  try {
    const { groupId } = req.params;
    const schema = z.object({
      homeworkId: z.string().min(1),
      files: z.array(z.string()).min(1, '请上传至少一个文件'),
      laborDivision: z.array(z.object({
        memberId: z.string(),
        memberName: z.string(),
        task: z.string(),
        contributionPercent: z.number().min(0).max(100),
        description: z.string().optional(),
      })).min(1, '请填写分工说明'),
    });
    const { homeworkId, files, laborDivision } = schema.parse(req.body);

    const group = await prisma.assignmentGroup.findUnique({
      where: { id: groupId },
      include: { homework: true },
    });

    if (!group) {
      return res.status(404).json({ error: '小组不存在' });
    }

    if (group.leaderId !== req.user!.userId) {
      return res.status(403).json({ error: '仅组长可提交作业' });
    }

    if (group.homeworkId !== homeworkId) {
      return res.status(400).json({ error: '小组与作业不匹配' });
    }

    // 创建或更新提交
    const submission = await prisma.submission.upsert({
      where: {
        studentId_homeworkId: {
          studentId: req.user!.userId,
          homeworkId,
        },
      },
      update: {
        files: JSON.stringify(files),
        groupId,
        laborDivision: JSON.stringify(laborDivision),
        submittedAt: new Date(),
      },
      create: {
        studentId: req.user!.userId,
        homeworkId,
        groupId,
        files: JSON.stringify(files),
        laborDivision: JSON.stringify(laborDivision),
      },
    });

    // 更新小组状态
    await prisma.assignmentGroup.update({
      where: { id: groupId },
      data: { status: 'SUBMITTED' },
    });

    res.json({ message: '项目作业提交成功', submission });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('提交项目作业失败:', error);
    res.status(500).json({ error: '提交项目作业失败' });
  }
});

// 教师批量设置个人成绩调整（项目小组作业）
router.post('/submission/:submissionId/adjust-scores', authenticate, requireTeacher, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const schema = z.object({
      adjustments: z.array(z.object({
        studentId: z.string(),
        baseScore: z.number().int().min(0),
        adjustScore: z.number().int(),
        finalScore: z.number().int().min(0),
        reason: z.string().optional(),
      })),
    });
    const { adjustments } = schema.parse(req.body);

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { homework: { include: { class: true } } },
    });

    if (!submission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    if (submission.homework.class.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权操作' });
    }

    // 批量创建/更新成绩调整
    const results = [];
    for (const adj of adjustments) {
      const result = await prisma.scoreAdjustment.upsert({
        where: {
          submissionId_studentId: {
            submissionId,
            studentId: adj.studentId,
          },
        },
        update: {
          baseScore: adj.baseScore,
          adjustScore: adj.adjustScore,
          finalScore: adj.finalScore,
          reason: adj.reason,
        },
        create: {
          submissionId,
          studentId: adj.studentId,
          baseScore: adj.baseScore,
          adjustScore: adj.adjustScore,
          finalScore: adj.finalScore,
          reason: adj.reason,
        },
      });
      results.push(result);

      // 记录审计日志
      await prisma.scoreAuditLog.create({
        data: {
          submissionId,
          studentId: adj.studentId,
          oldScore: null,
          newScore: adj.finalScore,
          reason: adj.reason || '项目小组成绩调整',
          operatorId: req.user!.userId,
        },
      });
    }

    res.json({ message: '成绩调整成功', adjustments: results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('成绩调整失败:', error);
    res.status(500).json({ error: '成绩调整失败' });
  }
});

export default router;
