import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { prisma } from '../index';
import { authenticate, requireTeacher, requireStudent } from '../middleware/auth';

const router = Router();

// ========== 学生仪表盘 ==========

// 获取学生仪表盘统计
router.get('/student/stats', authenticate, requireStudent, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // 获取学生所有已评分提交
    const submissions = await prisma.submission.findMany({
      where: { studentId: userId, score: { not: null } },
      include: { homework: { select: { maxScore: true } } },
    });

    const totalPoints = submissions.reduce((sum, s) => sum + (s.score ?? 0), 0);
    const maxPoints = submissions.reduce((sum, s) => sum + s.homework.maxScore, 0);

    // 课程进度：已提交作业数 / 应提交作业数
    const memberships = await prisma.classStudent.findMany({
      where: { studentId: userId },
      select: { classId: true },
    });
    const classIds = memberships.map(m => m.classId);

    const totalHomeworks = await prisma.homework.count({
      where: { classId: { in: classIds } },
    });
    const submittedCount = await prisma.submission.count({
      where: { studentId: userId },
    });
    const courseProgress = totalHomeworks > 0
      ? Math.round((submittedCount / totalHomeworks) * 100)
      : 0;

    // AI 互动指数：基于聊天消息数量（满分100，每10条消息+10分，上限100）
    const chatCount = await prisma.chatMessage.count({
      where: { userId, role: 'user' },
    });
    const aiInteractionScore = Math.min(100, Math.round(Math.log2(chatCount + 1) * 15));

    // 本周获得积分
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const weeklySubmissions = await prisma.submission.findMany({
      where: { studentId: userId, score: { not: null }, submittedAt: { gte: weekAgo } },
    });
    const weeklyPointsEarned = weeklySubmissions.reduce((sum, s) => sum + (s.score ?? 0), 0);

    // 排名（简单：基于总分在同班同学中的百分位）
    let rank = '—';
    let rankChange = 0;
    if (classIds.length > 0) {
      const classStudentIds = await prisma.classStudent.findMany({
        where: { classId: { in: classIds } },
        select: { studentId: true },
      });
      const uniqueStudentIds = [...new Set(classStudentIds.map(cs => cs.studentId))];

      // 一次查询获取所有同学的分数
      const allSubmissions = await prisma.submission.findMany({
        where: { studentId: { in: uniqueStudentIds }, score: { not: null } },
        select: { studentId: true, score: true, submittedAt: true },
      });

      // 当前排名
      const scoreMap: Record<string, number> = {};
      for (const sub of allSubmissions) {
        scoreMap[sub.studentId] = (scoreMap[sub.studentId] ?? 0) + (sub.score ?? 0);
      }
      const allScores = uniqueStudentIds.map(sid => scoreMap[sid] ?? 0);
      allScores.sort((a, b) => b - a);
      const myRank = allScores.indexOf(totalPoints) + 1;
      const percentile = allScores.length > 0
        ? Math.round((myRank / allScores.length) * 100)
        : 100;
      rank = `前${percentile}%`;

      // 上周排名（排除本周分数）
      const scoreMapLastWeek: Record<string, number> = {};
      for (const sub of allSubmissions) {
        if (new Date(sub.submittedAt) < weekAgo) {
          scoreMapLastWeek[sub.studentId] = (scoreMapLastWeek[sub.studentId] ?? 0) + (sub.score ?? 0);
        }
      }
      const lastWeekScores = uniqueStudentIds.map(sid => scoreMapLastWeek[sid] ?? 0);
      lastWeekScores.sort((a, b) => b - a);
      const myLastWeekScore = scoreMapLastWeek[userId] ?? 0;
      const myLastWeekRank = lastWeekScores.indexOf(myLastWeekScore) + 1;
      rankChange = myLastWeekRank - myRank; // positive = improved
    }

    // 互动活跃度评价
    let interactionLevel: string;
    if (aiInteractionScore >= 80) interactionLevel = '活跃度极高';
    else if (aiInteractionScore >= 60) interactionLevel = '活跃度高';
    else if (aiInteractionScore >= 40) interactionLevel = '活跃度中';
    else interactionLevel = '活跃度低';

    res.json({ totalPoints, maxPoints, rank, courseProgress, aiInteractionScore, weeklyPointsEarned, rankChange, interactionLevel });
  } catch (error) {
    console.error('获取学生仪表盘统计失败:', error);
    res.status(500).json({ error: '获取学生仪表盘统计失败' });
  }
});

// 获取学生学习模块状态
router.get('/student/modules', authenticate, requireStudent, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const memberships = await prisma.classStudent.findMany({
      where: { studentId: userId },
      select: { classId: true },
    });
    const classIds = memberships.map(m => m.classId);

    // 获取所有作业和提交
    const homeworks = await prisma.homework.findMany({
      where: { classId: { in: classIds } },
      include: { submissions: { where: { studentId: userId } } },
      orderBy: { deadline: 'desc' },
    });

    // --- 随堂测验: 标题含"测验/quiz/考试" 的作业 ---
    const quizHws = homeworks.filter(h =>
      /测验|quiz|考试|test/i.test(h.title)
    );
    const quizSubmitted = quizHws.filter(h => h.submissions.length > 0).length;
    const quizScored = quizHws.filter(h => h.submissions[0]?.score != null);
    const quizAvgRate = quizScored.length > 0
      ? Math.round(quizScored.reduce((sum, h) => sum + ((h.submissions[0].score ?? 0) / h.maxScore) * 100, 0) / quizScored.length)
      : 0;
    let quizLevel = '待提升';
    if (quizAvgRate >= 85) quizLevel = '优秀';
    else if (quizAvgRate >= 70) quizLevel = '良好';
    else if (quizAvgRate >= 60) quizLevel = '及格';

    // --- 编程实验: 标题含"实验/lab/编程/代码" 的作业 ---
    const labHws = homeworks.filter(h =>
      /实验|lab|编程|代码|coding/i.test(h.title)
    );
    const labPassed = labHws.filter(h => (h.submissions[0]?.score ?? 0) >= h.maxScore * 0.6).length;
    const latestLab = labHws[0];
    const labProgress = labHws.length > 0 ? Math.round((labPassed / labHws.length) * 100) : 0;
    let codeQuality = 'C';
    if (labProgress >= 90) codeQuality = 'A+';
    else if (labProgress >= 80) codeQuality = 'A-';
    else if (labProgress >= 70) codeQuality = 'B+';
    else if (labProgress >= 60) codeQuality = 'B';
    const labStatus = latestLab && latestLab.submissions.length > 0 && latestLab.submissions[0].score != null ? '已完成' : '进行中';

    // --- 课堂表现: 基于平时表现记录 ---
    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(now.getDate() - 28);
    const performanceRecords = await prisma.classPerformanceRecord.findMany({
      where: { studentId: userId, classId: { in: classIds }, occurredAt: { gte: fourWeeksAgo } },
      select: { type: true, score: true, occurredAt: true },
    });
    // 按周分组统计
    const weeklyPerformance = [0, 0, 0, 0];
    for (const rec of performanceRecords) {
      const daysAgo = Math.floor((now.getTime() - new Date(rec.occurredAt).getTime()) / (1000 * 60 * 60 * 24));
      const weekIdx = Math.min(3, Math.floor(daysAgo / 7));
      weeklyPerformance[3 - weekIdx]++;
    }
    const qaRecords = performanceRecords.filter(r => r.type === 'CLASSROOM_QA');
    const shareRecords = performanceRecords.filter(r => r.type === 'KNOWLEDGE_SHARE');
    const allScoresPerf = performanceRecords.filter(r => r.score != null).map(r => r.score as number);
    const avgPerfScore = allScoresPerf.length > 0
      ? Math.round((allScoresPerf.reduce((s, v) => s + v, 0) / allScoresPerf.length) * 10) / 10
      : 0;
    const qaScoredRecords = qaRecords.filter(r => r.score != null);
    const qaAvg = qaScoredRecords.length > 0
      ? qaScoredRecords.reduce((s, r) => s + (r.score as number), 0) / qaScoredRecords.length
      : 0;
    const shareScoredRecords = shareRecords.filter(r => r.score != null);
    const shareAvg = shareScoredRecords.length > 0
      ? shareScoredRecords.reduce((s, r) => s + (r.score as number), 0) / shareScoredRecords.length
      : 0;
    const compositeScore = Math.round((qaAvg * 0.5 + shareAvg * 0.5) * 10) / 10;

    // --- 小组项目: 基于班级同学生成 ---
    const classmates = await prisma.classStudent.findMany({
      where: { classId: { in: classIds }, studentId: { not: userId } },
      include: { student: { select: { id: true, name: true, avatar: true } } },
      take: 5,
    });
    const members = classmates.slice(0, 3).map((cs, i) => ({
      name: cs.student.name,
      avatar: cs.student.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=member${i}`,
    }));
    const extraMembers = Math.max(0, classmates.length - 3);
    // 最近截止的作业作为"项目"
    const nearestDeadline = homeworks.find(h => new Date(h.deadline) > now);
    const projectName = nearestDeadline?.title || '学习项目';
    const daysLeft = nearestDeadline
      ? Math.max(0, Math.ceil((new Date(nearestDeadline.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    res.json({
      quiz: {
        level: quizLevel,
        avgRate: quizAvgRate,
        completed: quizSubmitted,
        total: quizHws.length,
      },
      lab: {
        status: labStatus,
        currentTitle: latestLab?.title || '暂无实验',
        progress: labProgress,
        passed: labPassed,
        total: labHws.length,
        codeQuality,
      },
      classPerformance: {
        totalScore: compositeScore,
        totalRecords: performanceRecords.length,
        weeklyData: weeklyPerformance,
        qaCount: qaRecords.length,
        shareCount: shareRecords.length,
        avgScore: avgPerfScore,
      },
      groupProject: {
        members,
        extraMembers,
        projectName,
        daysLeft,
      },
    });
  } catch (error) {
    console.error('获取学习模块失败:', error);
    res.status(500).json({ error: '获取学习模块失败' });
  }
});

// 获取学生学习行为趋势（近7天提交/得分）
router.get('/student/trend', authenticate, requireStudent, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const dayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    // 近7天每天的得分
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const submissions = await prisma.submission.findMany({
      where: {
        studentId: userId,
        submittedAt: { gte: sevenDaysAgo },
      },
      select: { score: true, submittedAt: true },
    });

    // 按星期几统计分数
    const data = new Array(7).fill(0);
    const labels: string[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      const dayOfWeek = date.getDay(); // 0=Sun
      const labelIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon
      labels.push(dayLabels[labelIdx]);

      const daySubmissions = submissions.filter(s => {
        const d = new Date(s.submittedAt);
        return d.getDate() === date.getDate()
          && d.getMonth() === date.getMonth()
          && d.getFullYear() === date.getFullYear();
      });

      data[i] = daySubmissions.reduce((sum, s) => sum + (s.score ?? 0), 0);
    }

    res.json({ labels, data });
  } catch (error) {
    console.error('获取学习趋势失败:', error);
    res.status(500).json({ error: '获取学习趋势失败' });
  }
});

// 获取学生能力雷达（基于五维综合评估）
// 五维能力模型:
//   1. 知识掌握: 得分率加权平均（近期作业权重更高）
//   2. 实践能力: 作业完成率 × 0.4 + 得分质量 × 0.3 + 作业类型覆盖度 × 0.3
//   3. 课堂参与: 课堂表现记录评分 × 0.5 + 行为日志活跃度 × 0.3 + AI互动深度 × 0.2
//   4. 协作交流: 互评完成率 × 0.35 + 互评质量（给出的评分方差小）× 0.15 + 小组参与度 × 0.3 + 讨论活跃 × 0.2
//   5. 学习自驱力: 按时提交率 × 0.3 + 自主学习行为（资源/案例浏览）× 0.3 + 学习连续性（活跃天数占比）× 0.4
router.get('/student/radar', authenticate, requireStudent, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // 获取学生班级
    const memberships = await prisma.classStudent.findMany({
      where: { studentId: userId },
      select: { classId: true },
    });
    const classIds = memberships.map(m => m.classId);

    // Fetch all needed data in parallel
    const [
      allHomeworks,
      allSubmissions,
      performanceRecords,
      peerReviewsDone,
      peerReviewAssignmentsCount,
      groupMembershipCount,
      behaviorLogs,
      chatCount,
      user,
    ] = await Promise.all([
      prisma.homework.findMany({
        where: { classId: { in: classIds } },
        select: { id: true, title: true, type: true, maxScore: true, deadline: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.submission.findMany({
        where: { studentId: userId },
        include: { homework: { select: { id: true, maxScore: true, deadline: true, type: true } } },
      }),
      prisma.classPerformanceRecord.findMany({
        where: { studentId: userId, classId: { in: classIds } },
        select: { type: true, score: true },
      }),
      prisma.peerReview.findMany({
        where: { reviewerId: userId },
        select: { score: true },
      }),
      prisma.peerReviewAssignment.count({ where: { reviewerId: userId } }),
      prisma.assignmentGroupMember.count({ where: { studentId: userId } }),
      prisma.behaviorLog.findMany({
        where: { studentId: userId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { type: true, duration: true, createdAt: true },
      }),
      prisma.chatMessage.count({ where: { userId, role: 'user' } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);

    const totalHomeworks = allHomeworks.length;
    const scoredSubmissions = allSubmissions.filter(s => s.score !== null);

    // ===== 1) 知识掌握: 近期加权得分率 =====
    // 按时间排序, 越新的作业权重越高 (线性递增权重)
    let knowledgeScore = 0;
    if (scoredSubmissions.length > 0) {
      const sorted = [...scoredSubmissions].sort(
        (a, b) => new Date(a.homework.deadline).getTime() - new Date(b.homework.deadline).getTime()
      );
      let weightSum = 0;
      let weightedScore = 0;
      sorted.forEach((s, i) => {
        const weight = 1 + i * 0.5; // later homework gets more weight
        const pct = s.homework.maxScore > 0 ? ((s.score ?? 0) / s.homework.maxScore) * 100 : 0;
        weightedScore += pct * weight;
        weightSum += weight;
      });
      knowledgeScore = Math.round(weightedScore / weightSum);
    }

    // ===== 2) 实践能力: 完成率 × 0.4 + 得分质量 × 0.3 + 类型覆盖度 × 0.3 =====
    const completionRate = totalHomeworks > 0 ? (allSubmissions.length / totalHomeworks) * 100 : 0;
    const scoreQuality = scoredSubmissions.length > 0
      ? scoredSubmissions.reduce((sum, s) => sum + ((s.score ?? 0) / s.homework.maxScore) * 100, 0) / scoredSubmissions.length
      : 0;
    // Type coverage: how many distinct homework types the student has submitted
    const hwTypes = new Set(allHomeworks.map(h => h.type));
    const submittedTypes = new Set(allSubmissions.map(s => s.homework.type));
    const typeCoverage = hwTypes.size > 0 ? (submittedTypes.size / hwTypes.size) * 100 : 0;
    const practiceScore = Math.round(completionRate * 0.4 + scoreQuality * 0.3 + typeCoverage * 0.3);

    // ===== 3) 课堂参与: 表现评分 × 0.5 + 行为活跃度 × 0.3 + AI互动深度 × 0.2 =====
    let performanceBase = 0;
    if (performanceRecords.length > 0) {
      const scoredRecords = performanceRecords.filter(r => r.score != null);
      if (scoredRecords.length > 0) {
        const avgScore = scoredRecords.reduce((sum, r) => sum + (r.score as number), 0) / scoredRecords.length;
        performanceBase = Math.round((avgScore / 5) * 80); // scale 1-5 to 0-80
      }
      // participation frequency bonus (up to 20 points)
      performanceBase = Math.min(100, performanceBase + Math.min(20, performanceRecords.length * 3));
    }
    const totalBehaviorDuration = behaviorLogs.reduce((sum, l) => sum + l.duration, 0);
    const behaviorActive = Math.min(100, Math.round(Math.sqrt(totalBehaviorDuration / 60) * 10)); // sqrt-scaled
    const aiInteraction = Math.min(100, Math.round(Math.log2(chatCount + 1) * 15));
    const engagementScore = Math.round(performanceBase * 0.5 + behaviorActive * 0.3 + aiInteraction * 0.2);

    // ===== 4) 协作交流: 互评完成率 × 0.35 + 互评质量 × 0.15 + 小组参与度 × 0.3 + 讨论活跃 × 0.2 =====
    const peerReviewRate = peerReviewAssignmentsCount > 0
      ? Math.min(100, Math.round((peerReviewsDone.length / peerReviewAssignmentsCount) * 100))
      : 0;
    // Peer review quality: consistent scoring (lower std dev = higher quality)
    let peerReviewQuality = 0;
    if (peerReviewsDone.length >= 2) {
      const scores = peerReviewsDone.map(r => r.score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      // Lower std dev = more consistent = better quality. Scale: stdDev of 0 = 100, stdDev of 5 = 0
      peerReviewQuality = Math.max(0, Math.min(100, Math.round((1 - stdDev / 5) * 100)));
    } else if (peerReviewsDone.length === 1) {
      peerReviewQuality = 60; // single review, moderate quality
    }
    // Group participation: logarithmic scaling (1 group=40, 2=65, 3=80, 4+=100)
    const groupParticipation = groupMembershipCount > 0
      ? Math.min(100, Math.round(40 + Math.log2(groupMembershipCount) * 40))
      : 0;
    const discussionActive = Math.min(100, Math.round(Math.sqrt(chatCount) * 12));
    const collaborationScore = Math.round(
      peerReviewRate * 0.35 + peerReviewQuality * 0.15 + groupParticipation * 0.3 + discussionActive * 0.2
    );

    // ===== 5) 学习自驱力: 按时提交率 × 0.3 + 自主学习行为 × 0.3 + 学习连续性 × 0.4 =====
    const onTimeCount = allSubmissions.filter(
      s => new Date(s.submittedAt) <= new Date(s.homework.deadline)
    ).length;
    const onTimeRate = allSubmissions.length > 0 ? (onTimeCount / allSubmissions.length) * 100 : 0;

    // Self-directed learning: resource views + case views
    const selfLearningLogs = behaviorLogs.filter(
      l => l.type === 'RESOURCE_VIEW' || l.type === 'CASE_VIEW'
    );
    const selfLearningMinutes = selfLearningLogs.reduce((sum, l) => sum + l.duration, 0) / 60;
    const selfLearningScore = Math.min(100, Math.round(Math.sqrt(selfLearningMinutes) * 15));

    // Learning consistency: active days out of last 30 days
    const activeDays = new Set(
      behaviorLogs.map(l => new Date(l.createdAt).toISOString().slice(0, 10))
    ).size;
    const consistencyScore = Math.min(100, Math.round((activeDays / 30) * 100));

    const selfDriveScore = Math.round(onTimeRate * 0.3 + selfLearningScore * 0.3 + consistencyScore * 0.4);

    // 组装结果
    const labels = ['知识掌握', '实践能力', '课堂参与', '协作交流', '学习自驱力'];
    const scores = [
      Math.min(100, Math.max(0, knowledgeScore)),
      Math.min(100, Math.max(0, practiceScore)),
      Math.min(100, Math.max(0, engagementScore)),
      Math.min(100, Math.max(0, collaborationScore)),
      Math.min(100, Math.max(0, selfDriveScore)),
    ];

    // 找到最强和最弱维度
    const maxIdx = scores.indexOf(Math.max(...scores));
    const minIdx = scores.indexOf(Math.min(...scores));
    const strongLabel = labels[maxIdx];
    const weakLabel = labels[minIdx];

    const studentName = user?.name || '同学';

    const suggestionMap: Record<string, string> = {
      '知识掌握': '建议重点复习近期作业中的薄弱知识点，尝试归纳总结形成知识体系。',
      '实践能力': '建议尝试更多类型的作业，不仅完成基础任务，也尝试挑战性练习以提升实践水平。',
      '课堂参与': '建议积极参与课堂问答和知识分享，多利用AI助手进行课后学习巩固。',
      '协作交流': '建议认真参与同行互评，给出有建设性的反馈；积极参与小组讨论和项目合作。',
      '学习自驱力': '建议制定规律的学习计划，每天保持一定的学习时间，并主动浏览课程资源和案例库。',
    };

    const aiDiagnosis = {
      summary: `${studentName}，你的「${strongLabel}」能力表现突出（${scores[maxIdx]}分），但「${weakLabel}」维度（${scores[minIdx]}分）还有较大提升空间。`,
      suggestion: suggestionMap[weakLabel] || '继续保持当前学习节奏，全面发展各项能力。',
    };

    res.json({
      labels,
      data: scores,
      fullMark: 100,
      aiDiagnosis,
    });
  } catch (error) {
    console.error('获取能力雷达失败:', error);
    res.status(500).json({ error: '获取能力雷达失败' });
  }
});

// 获取学生最近活动
router.get('/student/activities', authenticate, requireStudent, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // 最近提交的作业作为活动
    const submissions = await prisma.submission.findMany({
      where: { studentId: userId },
      include: { homework: { select: { title: true, maxScore: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    });

    const activities = submissions.map(s => ({
      id: s.id,
      title: s.score !== null
        ? `作业「${s.homework.title}」已评分：${s.score}/${s.homework.maxScore}`
        : `提交了作业「${s.homework.title}」`,
      description: formatRelativeTime(s.submittedAt),
      points: s.score ?? 0,
      createdAt: s.submittedAt.toISOString(),
    }));

    res.json(activities);
  } catch (error) {
    console.error('获取最近活动失败:', error);
    res.status(500).json({ error: '获取最近活动失败' });
  }
});

// ========== 教师仪表盘 ==========

// 获取教师仪表盘统计
router.get('/teacher/stats', authenticate, requireTeacher, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // 获取教师的所有班级
    const classes = await prisma.class.findMany({
      where: { teacherId: userId },
      include: {
        students: true,
        homeworks: {
          include: { submissions: true },
        },
      },
    });

    const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0);
    const totalClasses = classes.length;

    // 本周提交率
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    let weeklySubmissions = 0;
    let weeklyExpected = 0;

    for (const cls of classes) {
      const weekHomeworks = cls.homeworks.filter(h => new Date(h.deadline) >= weekAgo);
      weeklyExpected += weekHomeworks.length * cls.students.length;
      for (const hw of weekHomeworks) {
        weeklySubmissions += hw.submissions.length;
      }
    }

    const submissionRate = weeklyExpected > 0
      ? Math.round((weeklySubmissions / weeklyExpected) * 100)
      : 0;

    // 需要关注的学生（提交率低于50%的学生数）
    const studentSubmissionMap: Record<string, { submitted: number; total: number }> = {};
    for (const cls of classes) {
      for (const stu of cls.students) {
        if (!studentSubmissionMap[stu.studentId]) {
          studentSubmissionMap[stu.studentId] = { submitted: 0, total: 0 };
        }
        studentSubmissionMap[stu.studentId].total += cls.homeworks.length;
        for (const hw of cls.homeworks) {
          if (hw.submissions.some(s => s.studentId === stu.studentId)) {
            studentSubmissionMap[stu.studentId].submitted++;
          }
        }
      }
    }

    const pendingAlerts = Object.values(studentSubmissionMap)
      .filter(s => s.total > 0 && (s.submitted / s.total) < 0.5).length;

    res.json({ totalStudents, totalClasses, submissionRate, pendingAlerts });
  } catch (error) {
    console.error('获取教师仪表盘统计失败:', error);
    res.status(500).json({ error: '获取教师仪表盘统计失败' });
  }
});

// 获取教师最近动态
router.get('/teacher/activities', authenticate, requireTeacher, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // 获取教师班级中的最近提交
    const classIds = (await prisma.class.findMany({
      where: { teacherId: userId },
      select: { id: true },
    })).map(c => c.id);

    const recentSubmissions = await prisma.submission.findMany({
      where: { homework: { classId: { in: classIds } } },
      include: {
        student: { select: { name: true } },
        homework: { select: { title: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    });

    const activities = recentSubmissions.map(s => ({
      id: s.id,
      title: `${s.student.name}提交了「${s.homework.title}」`,
      time: formatRelativeTime(s.submittedAt),
      type: 'submit' as const,
    }));

    res.json(activities);
  } catch (error) {
    console.error('获取教师动态失败:', error);
    res.status(500).json({ error: '获取教师动态失败' });
  }
});

// 获取教师待办任务
router.get('/teacher/tasks', authenticate, requireTeacher, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const classes = await prisma.class.findMany({
      where: { teacherId: userId },
      include: {
        homeworks: {
          include: {
            submissions: true,
            class: { include: { students: true } },
          },
          orderBy: { deadline: 'asc' },
        },
      },
    });

    const tasks: { id: string; title: string; deadline: string; _deadlineMs: number; count: number | null }[] = [];

    for (const cls of classes) {
      for (const hw of cls.homeworks) {
        // 未批改提交
        const ungradedCount = hw.submissions.filter(s => s.score === null).length;
        if (ungradedCount > 0) {
          tasks.push({
            id: hw.id,
            title: `批改「${hw.title}」`,
            deadline: new Date(hw.deadline).toLocaleDateString('zh-CN'),
            _deadlineMs: new Date(hw.deadline).getTime(),
            count: ungradedCount,
          });
        }
      }
    }

    // Sort by deadline (earliest first) and take top 10
    tasks.sort((a, b) => a._deadlineMs - b._deadlineMs);

    res.json(tasks.slice(0, 10).map(({ _deadlineMs, ...t }) => t));
  } catch (error) {
    console.error('获取教师待办失败:', error);
    res.status(500).json({ error: '获取教师待办失败' });
  }
});

// ========== 干预控制台 ==========

// 获取干预数据：每个学生的行为分和积分
router.get('/teacher/intervention/data', authenticate, requireTeacher, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // 获取教师的所有班级及其学生
    const classes = await prisma.class.findMany({
      where: { teacherId: userId },
      include: {
        students: {
          include: {
            student: { select: { id: true, name: true, avatar: true } },
          },
        },
        homeworks: {
          include: { submissions: true },
        },
      },
    });

    // 收集所有唯一学生
    const studentMap = new Map<string, { id: string; name: string; avatar: string | null }>();
    for (const cls of classes) {
      for (const cs of cls.students) {
        if (!studentMap.has(cs.studentId)) {
          studentMap.set(cs.studentId, cs.student);
        }
      }
    }

    // 计算每个学生的提交率和 AI 互动频率
    const studentIds = [...studentMap.keys()];

    // 一次性查询所有学生的聊天消息计数
    const chatCounts = await prisma.chatMessage.groupBy({
      by: ['userId'],
      where: { userId: { in: studentIds }, role: 'user' },
      _count: { id: true },
    });
    const chatCountMap = new Map(chatCounts.map(c => [c.userId, c._count.id]));

    // 计算每个学生的提交率
    const interventions = [];
    let totalPoints = 0;
    let warningCount = 0;

    for (const [studentId, student] of studentMap) {
      let totalHomeworks = 0;
      let submittedCount = 0;
      let earnedScore = 0;

      for (const cls of classes) {
        const isInClass = cls.students.some(s => s.studentId === studentId);
        if (!isInClass) continue;

        for (const hw of cls.homeworks) {
          totalHomeworks++;
          const submission = hw.submissions.find(s => s.studentId === studentId);
          if (submission) {
            submittedCount++;
            earnedScore += submission.score ?? 0;
          }
        }
      }

      // 行为分 = 提交率 * 60% + AI互动指数 * 40%
      // AI互动指数：log2(chatCount+1)/log2(50) 归一化到 [0,1]，约50条消息达到满分
      const submissionRate = totalHomeworks > 0 ? submittedCount / totalHomeworks : 0;
      const chatCount = chatCountMap.get(studentId) ?? 0;
      const aiScore = Math.min(1, Math.log2(chatCount + 1) / Math.log2(50));
      const behaviorScore = Math.round(submissionRate * 60 + aiScore * 40);

      // AI推荐方案
      let aiRecommendation: string;
      let priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
      if (behaviorScore < 50) {
        aiRecommendation = '推送基础层作业 + 一对一辅导';
        priority = 'URGENT';
        warningCount++;
      } else if (behaviorScore < 80) {
        aiRecommendation = '维持当前学习节奏';
        priority = 'NORMAL';
      } else {
        aiRecommendation = '推送挑战层任务 + 竞赛推荐';
        priority = 'LOW';
      }

      totalPoints += earnedScore;
      interventions.push({
        id: studentId,
        studentId,
        studentName: student.name,
        avatar: student.avatar,
        behaviorScore,
        currentPoints: earnedScore,
        aiRecommendation,
        type: 'BEHAVIOR',
        status: 'PENDING' as const,
        priority,
      });
    }

    // 统计
    const pendingInterventions = interventions.filter(i => i.behaviorScore < 80).length;
    const urgentCount = interventions.filter(i => i.priority === 'URGENT').length;
    const avgPoints = studentMap.size > 0 ? Math.round(totalPoints / studentMap.size) : 0;
    const highPerformers = interventions.filter(i => i.behaviorScore >= 80).length;

    // AI洞察文字
    const aiInsights = warningCount > 0
      ? `本周有 ${warningCount} 名学生行为分低于 50，建议重点关注。班级平均积分 ${avgPoints}，提交率较低的学生需要个别辅导。建议为预警学生推送基础层作业，同时为 ${highPerformers} 名高分学生提供挑战任务。`
      : `班级整体表现良好，平均积分 ${avgPoints}。${highPerformers} 名高分学生可推送挑战层任务以进一步提升。建议保持当前教学节奏。`;

    res.json({
      interventions,
      stats: {
        warningCount,
        pendingInterventions,
        urgentCount,
        avgPoints,
        highPerformers,
      },
      aiInsights,
    });
  } catch (error) {
    console.error('获取干预数据失败:', error);
    res.status(500).json({ error: '获取干预数据失败' });
  }
});

// AI 生成分层作业
router.post('/teacher/intervention/ai-homework', authenticate, requireTeacher, async (req, res) => {
  try {
    const schema = z.object({
      topic: z.string().min(2, '作业主题至少2个字符').max(200),
      classId: z.string().cuid('班级ID格式不正确'),
    });

    const { topic: rawTopic, classId } = schema.parse(req.body);

    // 清理主题输入，防止 prompt 注入
    const topic = rawTopic.replace(/[\r\n]+/g, ' ').replace(/[`{}]/g, '').trim();

    // 验证班级归属
    const classData = await prisma.class.findUnique({ where: { id: classId } });
    if (!classData) {
      return res.status(404).json({ error: '班级不存在' });
    }
    if (classData.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权向该班级发布作业' });
    }

    // 调用 AI 生成分层作业描述
    const baseUrl = process.env.AI_BASE_URL?.replace(/\/$/, '');
    if (!baseUrl) {
      return res.status(500).json({ error: 'AI_BASE_URL 未配置' });
    }
    const apiKey = process.env.AI_API_KEY;

    const aiPrompt = `请根据以下作业主题，生成一份包含三个难度层级的作业描述。请直接返回 JSON 格式，不要包含 markdown 代码块标记。

作业主题：${topic}

要求格式（纯 JSON，不要包含 \`\`\`json 标记）：
{
  "基础层": {
    "title": "基础层标题",
    "description": "详细的基础层作业要求（适合基础薄弱的学生，侧重概念理解和基本练习）"
  },
  "进阶层": {
    "title": "进阶层标题",
    "description": "详细的进阶层作业要求（适合全班大多数学生，侧重应用和分析）"
  },
  "挑战层": {
    "title": "挑战层标题",
    "description": "详细的挑战层作业要求（适合高水平学生，侧重创新和综合运用）"
  }
}`;

    const aiResponse = await axios.post(
      `${baseUrl}/v1/chat/completions`,
      {
        model: process.env.AI_MODEL || 'deepseek-ai/DeepSeek-V3',
        messages: [
          { role: 'system', content: '你是一位经验丰富的教育专家，擅长设计分层教学作业。请直接返回纯 JSON 格式，不要使用 markdown 代码块。' },
          { role: 'user', content: aiPrompt },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      },
    );

    const aiContent = aiResponse.data?.choices?.[0]?.message?.content || '';

    // 尝试解析 AI 返回的 JSON（兼容 markdown 包裹）
    let tieredHomework: Record<string, { title: string; description: string }>;
    try {
      // 提取第一个 { 到最后一个 } 之间的内容，更健壮地处理 markdown 包裹
      const firstBrace = aiContent.indexOf('{');
      const lastBrace = aiContent.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('No JSON object found');
      }
      const jsonStr = aiContent.slice(firstBrace, lastBrace + 1);
      tieredHomework = JSON.parse(jsonStr);
    } catch {
      // 如果 AI 返回无法解析，使用默认模板
      tieredHomework = {
        '基础层': { title: `${topic} - 基础练习`, description: `围绕「${topic}」进行基础概念复习和简单练习。` },
        '进阶层': { title: `${topic} - 进阶应用`, description: `围绕「${topic}」进行综合应用和分析练习。` },
        '挑战层': { title: `${topic} - 挑战拓展`, description: `围绕「${topic}」进行拓展研究和创新设计。` },
      };
    }

    // 保存三个层级的作业到数据库
    const now = new Date();
    const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 默认7天截止

    const createdHomeworks = [];
    for (const [level, content] of Object.entries(tieredHomework)) {
      const homework = await prisma.homework.create({
        data: {
          title: content.title || `${topic} - ${level}`,
          description: content.description || `${topic} ${level}作业`,
          classId,
          startTime: now,
          deadline,
          maxScore: 100,
          allowLate: true,
        },
        include: { class: { select: { name: true } } },
      });
      createdHomeworks.push({ level, homework });
    }

    res.status(201).json({
      message: '分层作业已生成并发布',
      homeworks: createdHomeworks,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('AI生成作业失败:', error);
    res.status(500).json({ error: 'AI生成作业失败' });
  }
});

// ========== 干预记录 CRUD ==========

// 创建干预记录（教师）
router.post('/teacher/intervention', authenticate, requireTeacher, async (req, res) => {
  try {
    const schema = z.object({
      studentId: z.string().min(1, '学生ID不能为空'),
      type: z.enum(['SUBMISSION_WARNING', 'ENGAGEMENT_WARNING', 'BEHAVIOR']),
      priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
      description: z.string().max(500).optional(),
      aiRecommendation: z.string().max(500).optional(),
    });

    const data = schema.parse(req.body);

    const intervention = await prisma.intervention.create({
      data: {
        studentId: data.studentId,
        teacherId: req.user!.userId,
        type: data.type,
        priority: data.priority,
        description: data.description,
        aiRecommendation: data.aiRecommendation,
      },
      include: {
        student: { select: { id: true, name: true, avatar: true } },
      },
    });

    res.status(201).json({ message: '干预记录创建成功', intervention });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('创建干预记录失败:', error);
    res.status(500).json({ error: '创建干预记录失败' });
  }
});

// 获取教师的干预记录列表
router.get('/teacher/interventions', authenticate, requireTeacher, async (req, res) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { teacherId: req.user!.userId };
    if (status) {
      where.status = String(status);
    }

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));
    const skip = (pageNum - 1) * limitNum;

    const [interventions, total] = await Promise.all([
      prisma.intervention.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          student: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.intervention.count({ where }),
    ]);

    res.json({
      interventions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('获取干预记录列表失败:', error);
    res.status(500).json({ error: '获取干预记录列表失败' });
  }
});

// 更新干预记录状态（教师）
router.put('/teacher/intervention/:id', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
      notes: z.string().max(500).optional(),
      priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional(),
    });

    const data = schema.parse(req.body);

    const intervention = await prisma.intervention.findUnique({ where: { id } });
    if (!intervention) {
      return res.status(404).json({ error: '干预记录不存在' });
    }
    if (intervention.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权修改此干预记录' });
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.status === 'COMPLETED') {
      updateData.resolvedAt = new Date();
    }

    const updated = await prisma.intervention.update({
      where: { id },
      data: updateData,
      include: {
        student: { select: { id: true, name: true, avatar: true } },
      },
    });

    res.json({ message: '干预记录更新成功', intervention: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('更新干预记录失败:', error);
    res.status(500).json({ error: '更新干预记录失败' });
  }
});

// 删除干预记录（教师）
router.delete('/teacher/intervention/:id', authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    const intervention = await prisma.intervention.findUnique({ where: { id } });
    if (!intervention) {
      return res.status(404).json({ error: '干预记录不存在' });
    }
    if (intervention.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: '无权删除此干预记录' });
    }

    await prisma.intervention.delete({ where: { id } });

    res.json({ message: '干预记录删除成功' });
  } catch (error) {
    console.error('删除干预记录失败:', error);
    res.status(500).json({ error: '删除干预记录失败' });
  }
});

// ========== 教师 AI 教学建议 ==========

router.get('/teacher/ai-suggestion', authenticate, requireTeacher, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // 获取教师的所有班级
    const classes = await prisma.class.findMany({
      where: { teacherId: userId },
      include: {
        students: true,
        homeworks: {
          include: { submissions: true },
        },
      },
    });

    const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0);

    // 计算整体提交率
    let totalExpected = 0;
    let totalSubmitted = 0;
    for (const cls of classes) {
      totalExpected += cls.homeworks.length * cls.students.length;
      for (const hw of cls.homeworks) {
        totalSubmitted += hw.submissions.length;
      }
    }
    const overallSubmissionRate = totalExpected > 0
      ? Math.round((totalSubmitted / totalExpected) * 100)
      : 0;

    // 计算平均分
    let totalScore = 0;
    let scoredCount = 0;
    for (const cls of classes) {
      for (const hw of cls.homeworks) {
        for (const sub of hw.submissions) {
          if (sub.score !== null) {
            totalScore += sub.score;
            scoredCount++;
          }
        }
      }
    }
    const avgScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

    // 低提交率学生数
    const studentSubmissionMap: Record<string, { submitted: number; total: number }> = {};
    for (const cls of classes) {
      for (const stu of cls.students) {
        if (!studentSubmissionMap[stu.studentId]) {
          studentSubmissionMap[stu.studentId] = { submitted: 0, total: 0 };
        }
        studentSubmissionMap[stu.studentId].total += cls.homeworks.length;
        for (const hw of cls.homeworks) {
          if (hw.submissions.some(s => s.studentId === stu.studentId)) {
            studentSubmissionMap[stu.studentId].submitted++;
          }
        }
      }
    }
    const lowSubmissionStudents = Object.values(studentSubmissionMap)
      .filter(s => s.total > 0 && (s.submitted / s.total) < 0.5).length;

    // 动态生成建议
    const suggestions: string[] = [];
    if (overallSubmissionRate < 60) {
      suggestions.push(`当前作业整体提交率为 ${overallSubmissionRate}%，偏低。建议通过课堂提醒和个别沟通提高学生参与度。`);
    } else if (overallSubmissionRate < 80) {
      suggestions.push(`作业整体提交率 ${overallSubmissionRate}%，尚可。可对未提交学生进行针对性跟进。`);
    } else {
      suggestions.push(`作业整体提交率 ${overallSubmissionRate}%，表现良好。建议为高完成度学生推送进阶挑战任务。`);
    }

    if (lowSubmissionStudents > 0) {
      suggestions.push(`有 ${lowSubmissionStudents} 名学生提交率低于 50%，建议推送基础巩固资源并安排一对一辅导。`);
    }

    if (avgScore > 0 && avgScore < 60) {
      suggestions.push(`班级平均分 ${avgScore} 分，建议回顾近期教学内容，加强薄弱知识点的练习。`);
    } else if (avgScore >= 85) {
      suggestions.push(`班级平均分 ${avgScore} 分，整体掌握良好。可适当提高作业难度或发布挑战任务。`);
    }

    if (totalStudents === 0) {
      suggestions.push('当前暂无学生数据，请先创建班级并邀请学生加入。');
    }

    const suggestion = suggestions.length > 0
      ? suggestions.join(' ')
      : '班级整体表现良好，建议保持当前教学节奏。';

    res.json({ suggestion });
  } catch (error) {
    console.error('获取AI教学建议失败:', error);
    res.status(500).json({ error: '获取AI教学建议失败' });
  }
});

// ========== 学生报告导出 ==========

router.get('/student/report/export', authenticate, requireStudent, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const studentName = user?.name || '同学';

    // 获取统计数据
    const submissions = await prisma.submission.findMany({
      where: { studentId: userId, score: { not: null } },
      include: { homework: { select: { maxScore: true, title: true } } },
    });
    const totalPoints = submissions.reduce((sum, s) => sum + (s.score ?? 0), 0);
    const maxPoints = submissions.reduce((sum, s) => sum + s.homework.maxScore, 0);

    const memberships = await prisma.classStudent.findMany({
      where: { studentId: userId },
      select: { classId: true },
    });
    const classIds = memberships.map(m => m.classId);
    const totalHomeworks = await prisma.homework.count({ where: { classId: { in: classIds } } });
    const submittedCount = await prisma.submission.count({ where: { studentId: userId } });
    const courseProgress = totalHomeworks > 0 ? Math.round((submittedCount / totalHomeworks) * 100) : 0;

    const chatCount = await prisma.chatMessage.count({ where: { userId, role: 'user' } });
    const aiInteractionScore = Math.min(100, Math.round(Math.log2(chatCount + 1) * 15));

    // 获取作业明细
    const allSubmissions = await prisma.submission.findMany({
      where: { studentId: userId },
      include: { homework: { select: { title: true, maxScore: true, deadline: true } } },
      orderBy: { submittedAt: 'desc' },
    });

    // 生成 CSV 内容
    const BOM = '\uFEFF';
    const csvLines: string[] = [];
    csvLines.push(`学习报告 - ${studentName}`);
    csvLines.push(`生成日期,${new Date().toLocaleDateString('zh-CN')}`);
    csvLines.push('');
    csvLines.push('== 统计概览 ==');
    csvLines.push(`总积分,${totalPoints} / ${maxPoints}`);
    csvLines.push(`课程进度,${courseProgress}%`);
    csvLines.push(`AI 互动指数,${aiInteractionScore} / 100`);
    csvLines.push('');
    csvLines.push('== 作业明细 ==');
    csvLines.push('作业名称,满分,得分,提交时间,截止时间');
    for (const sub of allSubmissions) {
      // Replace commas with Chinese commas to avoid breaking CSV delimiter
      const title = sub.homework.title.replace(/,/g, '，');
      const score = sub.score !== null ? String(sub.score) : '未评分';
      const submitted = new Date(sub.submittedAt).toLocaleDateString('zh-CN');
      const deadline = new Date(sub.homework.deadline).toLocaleDateString('zh-CN');
      csvLines.push(`${title},${sub.homework.maxScore},${score},${submitted},${deadline}`);
    }

    const csvContent = BOM + csvLines.join('\n');
    const buffer = Buffer.from(csvContent, 'utf-8');
    const filename = encodeURIComponent(`学习报告_${studentName}_${new Date().toISOString().slice(0, 10)}.csv`);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('导出学生报告失败:', error);
    res.status(500).json({ error: '导出学生报告失败' });
  }
});

// 辅助函数：相对时间格式化
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
