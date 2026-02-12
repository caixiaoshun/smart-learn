import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, requireTeacher, requireStudent } from '../middleware/auth';

const router = Router();

// Clustering composite score weights
const CLUSTER_SCORE_WEIGHT = 0.5;
const CLUSTER_SUBMISSION_WEIGHT = 0.3;
const CLUSTER_ONTIME_WEIGHT = 0.2;

// Score range boundaries for comprehensive stats
const SCORE_RANGES = [
  { label: '优秀 (90-100)', min: 90, max: 100, color: '#22c55e' },
  { label: '良好 (80-89)', min: 80, max: 89, color: '#3b82f6' },
  { label: '中等 (70-79)', min: 70, max: 79, color: '#f59e0b' },
  { label: '及格 (60-69)', min: 60, max: 69, color: '#f97316' },
  { label: '不及格 (<60)', min: 0, max: 59, color: '#ef4444' },
] as const;

async function ensureClassOwner(classId: string, teacherId: string) {
  const classData = await prisma.class.findUnique({ where: { id: classId } });
  if (!classData) return { ok: false, code: 404, error: '班级不存在' };
  if (classData.teacherId !== teacherId) return { ok: false, code: 403, error: '无权访问此班级数据' };
  return { ok: true, classData };
}

function rejectPermission(res: any, permission: { code: number; error: string }) {
  return res.status(permission.code).json({ error: permission.error });
}

router.get('/class/:classId/homeworks', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { select: { studentId: true } },
        homeworks: {
          include: {
            submissions: { include: { student: { select: { id: true, name: true, email: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const studentCount = classData!.students.length;
    const homeworks = classData!.homeworks.map((hw) => {
      const scored = hw.submissions.filter((s) => s.score !== null);
      const scores = scored.map((s) => s.score as number);
      return {
        id: hw.id,
        title: hw.title,
        deadline: hw.deadline,
        maxScore: hw.maxScore,
        statistics: {
          totalStudents: studentCount,
          submitted: hw.submissions.length,
          notSubmitted: Math.max(0, studentCount - hw.submissions.length),
          submissionRate: studentCount > 0 ? Math.round((hw.submissions.length / studentCount) * 100) : 0,
          scoredCount: scored.length,
          notScoredCount: hw.submissions.length - scored.length,
          ...(scores.length > 0 && {
            highestScore: Math.max(...scores),
            lowestScore: Math.min(...scores),
            averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          }),
        },
      };
    });

    res.json({ homeworks });
  } catch (error) {
    console.error('获取班级作业统计失败:', error);
    res.status(500).json({ error: '获取班级作业统计失败' });
  }
});

router.get('/homework/:homeworkId/distribution', authenticate, requireTeacher, async (req, res) => {
  try {
    const { homeworkId } = req.params;
    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: {
        class: true,
        submissions: { include: { student: { select: { id: true, name: true } } } },
      },
    });
    if (!homework) return res.status(404).json({ error: '作业不存在' });
    if (homework.class.teacherId !== req.user!.userId) return res.status(403).json({ error: '无权访问' });

    const ranges = [
      { label: '90-100', min: 90, max: 100, count: 0 },
      { label: '80-89', min: 80, max: 89, count: 0 },
      { label: '70-79', min: 70, max: 79, count: 0 },
      { label: '60-69', min: 60, max: 69, count: 0 },
      { label: '<60', min: 0, max: 59, count: 0 },
    ];

    const scored = homework.submissions.filter((s) => s.score !== null) as Array<typeof homework.submissions[number] & { score: number }>;
    for (const s of scored) {
      const pct = homework.maxScore > 0 ? Math.round((s.score / homework.maxScore) * 100) : 0;
      const r = ranges.find((x) => pct >= x.min && pct <= x.max);
      if (r) r.count += 1;
    }

    const total = scored.length;
    res.json({
      distribution: ranges.map((r) => ({ label: r.label, count: r.count, percentage: total > 0 ? Math.round((r.count / total) * 100) : 0 })),
      homework: {
        id: homework.id,
        title: homework.title,
        maxScore: homework.maxScore,
        scoredCount: total,
      },
    });
  } catch (error) {
    console.error('获取成绩分布失败:', error);
    res.status(500).json({ error: '获取成绩分布失败' });
  }
});

router.get('/class/:classId/overview', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { include: { student: true } },
        homeworks: {
          include: {
            submissions: {
              include: {
                student: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    const studentCount = classData!.students.length;
    const homeworkCount = classData!.homeworks.length;
    const totalExpected = studentCount * homeworkCount;
    let totalSubmissions = 0;
    let totalScore = 0;
    let scoredCount = 0;

    for (const hw of classData!.homeworks) {
      totalSubmissions += hw.submissions.length;
      for (const sub of hw.submissions) {
        if (sub.score !== null) {
          totalScore += sub.score;
          scoredCount += 1;
        }
      }
    }

    const overallSubmissionRate = totalExpected > 0 ? Math.round((totalSubmissions / totalExpected) * 100) : 0;
    const averageScore = scoredCount > 0 ? Math.round((totalScore / scoredCount) * 10) / 10 : 0;

    const studentPerformance = classData!.students.map((cs) => {
      let score = 0;
      let subCount = 0;
      for (const hw of classData!.homeworks) {
        const submission = hw.submissions.find((s) => s.studentId === cs.studentId);
        if (submission && submission.score !== null) {
          score += submission.score;
          subCount += 1;
        }
      }
      return { id: cs.student.id, name: cs.student.name, totalScore: score, submissionCount: subCount };
    });

    const topStudents = [...studentPerformance].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5);
    const needAttention = [...studentPerformance].sort((a, b) => a.totalScore - b.totalScore).slice(0, 5);

    res.json({
      class: { id: classData!.id, name: classData!.name, studentCount, homeworkCount },
      overview: { overallSubmissionRate, averageScore, totalSubmissions, totalExpected },
      topStudents,
      needAttention,
    });
  } catch (error) {
    console.error('获取班级概览失败:', error);
    res.status(500).json({ error: '获取班级概览失败' });
  }
});

// AI 学情分析报告
router.get('/class/:classId/ai-report', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const [overviewRes, homeworksRes] = await Promise.all([
      prisma.class.findUnique({ where: { id: classId }, include: { students: true, homeworks: { include: { submissions: true } } } }),
      prisma.homework.findMany({ where: { classId }, include: { submissions: true }, orderBy: { createdAt: 'desc' }, take: 3 }),
    ]);

    const studentCount = overviewRes?.students.length || 0;
    const hwCount = overviewRes?.homeworks.length || 0;
    const expected = studentCount * hwCount;
    const submitted = overviewRes?.homeworks.reduce((sum, hw) => sum + hw.submissions.length, 0) || 0;
    const submissionRate = expected > 0 ? Math.round((submitted / expected) * 100) : 0;

    const latestHomeworkInsights = homeworksRes.map((hw) => {
      const scored = hw.submissions.filter((s) => s.score !== null).map((s) => s.score as number);
      return {
        homeworkId: hw.id,
        title: hw.title,
        submitRate: studentCount > 0 ? Math.round((hw.submissions.length / studentCount) * 100) : 0,
        avgScore: scored.length > 0 ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : 0,
      };
    });

    const suggestions: string[] = [];
    if (submissionRate < 70) suggestions.push('整体提交率偏低，建议按风险学生名单进行分层提醒并设置阶段性检查点。');
    else suggestions.push('整体提交率良好，可增加挑战任务提升高分段学生能力。');

    if (latestHomeworkInsights.some((i) => i.avgScore < 70)) suggestions.push('近期作业平均分偏低，建议安排针对性知识点复盘和课堂演练。');

    res.json({
      report: {
        classId,
        generatedAt: new Date().toISOString(),
        submissionRate,
        latestHomeworkInsights,
        summary: suggestions.join(' '),
      },
    });
  } catch (error) {
    console.error('获取AI学情报告失败:', error);
    res.status(500).json({ error: '获取AI学情报告失败' });
  }
});

// 成绩趋势对比（班级作业序列）
router.get('/class/:classId/trend-compare', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const homeworks = await prisma.homework.findMany({
      where: { classId },
      include: { submissions: true },
      orderBy: { createdAt: 'asc' },
    });

    const trend = homeworks.map((hw) => {
      const scored = hw.submissions.filter((s) => s.score !== null).map((s) => s.score as number);
      const avg = scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
      return {
        homeworkId: hw.id,
        homeworkTitle: hw.title,
        averageScore: Math.round(avg * 10) / 10,
        averagePercentage: hw.maxScore > 0 ? Math.round((avg / hw.maxScore) * 100) : 0,
        deadline: hw.deadline,
      };
    });

    res.json({ trend });
  } catch (error) {
    console.error('获取成绩趋势对比失败:', error);
    res.status(500).json({ error: '获取成绩趋势对比失败' });
  }
});

// 分组成绩对比（项目作业）
router.get('/homework/:homeworkId/group-compare', authenticate, requireTeacher, async (req, res) => {
  try {
    const { homeworkId } = req.params;
    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: {
        class: true,
        groups: {
          include: {
            members: { include: { student: { select: { id: true, name: true } } } },
            submissions: true,
          },
        },
      },
    });

    if (!homework) return res.status(404).json({ error: '作业不存在' });
    if (homework.class.teacherId !== req.user!.userId) return res.status(403).json({ error: '无权访问' });

    const groups = homework.groups.map((group) => {
      const scored = group.submissions.filter((s) => s.score !== null).map((s) => s.score as number);
      const avg = scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
      return {
        groupId: group.id,
        groupName: group.name,
        memberCount: group.members.length,
        averageScore: Math.round(avg * 10) / 10,
        averagePercentage: homework.maxScore > 0 ? Math.round((avg / homework.maxScore) * 100) : 0,
      };
    });

    res.json({ groups });
  } catch (error) {
    console.error('获取分组成绩对比失败:', error);
    res.status(500).json({ error: '获取分组成绩对比失败' });
  }
});

router.get('/student/trend', authenticate, requireStudent, async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { studentId: req.user!.userId, score: { not: null } },
      include: { homework: { select: { id: true, title: true, deadline: true, maxScore: true } } },
      orderBy: { submittedAt: 'asc' },
    });
    const trend = submissions.map((s) => ({
      homeworkId: s.homework.id,
      homeworkTitle: s.homework.title,
      deadline: s.homework.deadline,
      score: s.score,
      maxScore: s.homework.maxScore,
      percentage: s.homework.maxScore > 0 && s.score !== null ? Math.round((s.score / s.homework.maxScore) * 100) : 0,
      submittedAt: s.submittedAt,
    }));
    const scores = trend.map((t) => t.percentage);

    res.json({
      trend,
      statistics: {
        totalSubmitted: submissions.length,
        averagePercentage: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        highestPercentage: scores.length > 0 ? Math.max(...scores) : 0,
        lowestPercentage: scores.length > 0 ? Math.min(...scores) : 0,
        trendDirection: scores.length >= 2 ? (scores[scores.length - 1] > scores[0] ? 'up' : scores[scores.length - 1] < scores[0] ? 'down' : 'stable') : 'stable',
      },
    });
  } catch (error) {
    console.error('获取成绩走势失败:', error);
    res.status(500).json({ error: '获取成绩走势失败' });
  }
});

router.get('/student/:studentId/trend', authenticate, requireTeacher, async (req, res) => {
  try {
    const { studentId } = req.params;
    const memberships = await prisma.classStudent.findMany({ where: { studentId }, include: { class: true, student: true } });
    if (memberships.length === 0) return res.status(404).json({ error: '学生不存在或未加入班级' });
    if (!memberships.some((m) => m.class.teacherId === req.user!.userId)) return res.status(403).json({ error: '无权查看此学生数据' });

    const submissions = await prisma.submission.findMany({
      where: { studentId, score: { not: null } },
      include: { homework: { select: { id: true, title: true, deadline: true, maxScore: true } } },
      orderBy: { submittedAt: 'asc' },
    });

    const trend = submissions.map((s) => ({
      homeworkId: s.homework.id,
      homeworkTitle: s.homework.title,
      deadline: s.homework.deadline,
      score: s.score,
      maxScore: s.homework.maxScore,
      percentage: s.homework.maxScore > 0 && s.score !== null ? Math.round((s.score / s.homework.maxScore) * 100) : 0,
      submittedAt: s.submittedAt,
    }));

    const scores = trend.map((t) => t.percentage);
    res.json({
      student: { id: memberships[0].student.id, name: memberships[0].student.name, email: memberships[0].student.email },
      trend,
      statistics: {
        totalSubmitted: submissions.length,
        averagePercentage: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        highestPercentage: scores.length > 0 ? Math.max(...scores) : 0,
        lowestPercentage: scores.length > 0 ? Math.min(...scores) : 0,
      },
    });
  } catch (error) {
    console.error('获取学生成绩走势失败:', error);
    res.status(500).json({ error: '获取学生成绩走势失败' });
  }
});

// 学生表现二维散点图 (inspired by EduAnalytics studentPerformance2D)
router.get('/class/:classId/performance-scatter', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { include: { student: { select: { id: true, name: true } } } },
        homeworks: { include: { submissions: true } },
      },
    });

    if (!classData) return res.status(404).json({ error: '班级不存在' });

    const homeworkCount = classData.homeworks.length;
    const points = classData.students.map((cs) => {
      let totalScore = 0;
      let totalMaxScore = 0;
      let submittedCount = 0;

      for (const hw of classData.homeworks) {
        const sub = hw.submissions.find((s) => s.studentId === cs.studentId);
        if (sub) {
          submittedCount++;
          if (sub.score !== null) {
            totalScore += sub.score;
            totalMaxScore += hw.maxScore;
          }
        }
      }

      const avgScoreRate = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
      const submissionRate = homeworkCount > 0 ? Math.round((submittedCount / homeworkCount) * 100) : 0;

      return {
        name: cs.student.name,
        studentId: cs.student.id,
        x: submissionRate,   // x-axis: submission rate
        y: avgScoreRate,     // y-axis: average score rate
      };
    });

    res.json({
      points,
      xLabel: '提交率 (%)',
      yLabel: '平均得分率 (%)',
    });
  } catch (error) {
    console.error('获取学生表现散点图失败:', error);
    res.status(500).json({ error: '获取学生表现散点图失败' });
  }
});

// 班级综合成绩统计 (inspired by EduAnalytics resultAnalysic)
router.get('/class/:classId/comprehensive-stats', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { include: { student: { select: { id: true, name: true } } } },
        homeworks: {
          include: { submissions: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!classData) return res.status(404).json({ error: '班级不存在' });

    const studentCount = classData.students.length;
    const homeworkCount = classData.homeworks.length;

    // Overall score distribution (ring chart)
    const allScores: number[] = [];
    for (const hw of classData.homeworks) {
      for (const sub of hw.submissions) {
        if (sub.score !== null) {
          const pct = hw.maxScore > 0 ? Math.round((sub.score / hw.maxScore) * 100) : 0;
          allScores.push(pct);
        }
      }
    }

    const scoreRangeCounts = SCORE_RANGES.map(r => ({ ...r, count: 0 }));

    for (const score of allScores) {
      const range = scoreRangeCounts.find((r) => score >= r.min && score <= r.max);
      if (range) range.count++;
    }

    const totalScored = allScores.length;
    const avgScore = totalScored > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / totalScored) : 0;
    const medianScore = totalScored > 0 ? (() => {
      const sorted = [...allScores].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    })() : 0;
    const stdDev = totalScored > 0 ? Math.round(Math.sqrt(allScores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / totalScored)) : 0;
    const passRate = totalScored > 0 ? Math.round((allScores.filter((s) => s >= 60).length / totalScored) * 100) : 0;
    const excellentRate = totalScored > 0 ? Math.round((allScores.filter((s) => s >= 90).length / totalScored) * 100) : 0;

    // Homework-by-homework trend
    const homeworkTrend = classData.homeworks.map((hw) => {
      const scored = hw.submissions.filter((s) => s.score !== null).map((s) => s.score as number);
      const avg = scored.length > 0 ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length / hw.maxScore) * 100) : 0;
      const highest = scored.length > 0 ? Math.round((Math.max(...scored) / hw.maxScore) * 100) : 0;
      const lowest = scored.length > 0 ? Math.round((Math.min(...scored) / hw.maxScore) * 100) : 0;
      return {
        title: hw.title,
        avg,
        highest,
        lowest,
        submissionRate: studentCount > 0 ? Math.round((hw.submissions.length / studentCount) * 100) : 0,
      };
    });

    res.json({
      overview: {
        studentCount,
        homeworkCount,
        totalScored,
        avgScore,
        medianScore,
        stdDev,
        passRate,
        excellentRate,
      },
      scoreDistribution: scoreRangeCounts.map((r) => ({
        label: r.label,
        count: r.count,
        percentage: totalScored > 0 ? Math.round((r.count / totalScored) * 100) : 0,
        color: r.color,
      })),
      homeworkTrend,
    });
  } catch (error) {
    console.error('获取综合成绩统计失败:', error);
    res.status(500).json({ error: '获取综合成绩统计失败' });
  }
});

// ========== 子任务 1: 教师端深度数据分析 ==========

// 1A: 成绩构成环形图
router.get('/class/:classId/grade-composition', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { select: { studentId: true } },
        homeworks: { include: { submissions: true, selfAssessments: true, peerReviews: true } },
        performanceRecords: true,
      },
    });
    if (!classData) return res.status(404).json({ error: '班级不存在' });

    const studentIds = classData.students.map(s => s.studentId);
    const studentCount = studentIds.length;

    // Homework average score
    let totalHwScore = 0;
    let hwScoredCount = 0;
    for (const hw of classData.homeworks) {
      for (const sub of hw.submissions) {
        if (sub.score !== null && studentIds.includes(sub.studentId)) {
          totalHwScore += (sub.score / hw.maxScore) * 100;
          hwScoredCount++;
        }
      }
    }
    const hwAvg = hwScoredCount > 0 ? Math.round(totalHwScore / hwScoredCount) : 0;

    // Class performance average
    const perfRecords = classData.performanceRecords.filter(r => r.score != null && studentIds.includes(r.studentId));
    const perfAvg = perfRecords.length > 0
      ? Math.round((perfRecords.reduce((sum, r) => sum + (r.score as number), 0) / perfRecords.length) / 5 * 100)
      : 0;

    // Self-assessment average
    const selfAssessments = classData.homeworks.flatMap(hw => hw.selfAssessments.filter(sa => studentIds.includes(sa.studentId)));
    const selfAvg = selfAssessments.length > 0
      ? Math.round(selfAssessments.reduce((sum, sa) => sum + sa.score, 0) / selfAssessments.length)
      : 0;

    // Peer review average
    const peerReviews = classData.homeworks.flatMap(hw => hw.peerReviews.filter(pr => studentIds.includes(pr.reviewerId)));
    const peerAvg = peerReviews.length > 0
      ? Math.round(peerReviews.reduce((sum, pr) => sum + pr.score, 0) / peerReviews.length)
      : 0;

    res.json({
      composition: [
        { name: '作业平均分', value: hwAvg, color: '#3b82f6' },
        { name: '平时表现', value: perfAvg, color: '#22c55e' },
        { name: '自评平均分', value: selfAvg, color: '#f59e0b' },
        { name: '互评平均分', value: peerAvg, color: '#8b5cf6' },
      ],
      studentCount,
    });
  } catch (error) {
    console.error('获取成绩构成失败:', error);
    res.status(500).json({ error: '获取成绩构成失败' });
  }
});

// 1B: 6维指标雷达图
router.get('/class/:classId/indicator-radar', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { select: { studentId: true } },
        homeworks: {
          include: {
            submissions: true,
            selfAssessments: true,
            peerReviews: true,
            peerReviewAssignments: true,
          },
        },
        performanceRecords: true,
      },
    });
    if (!classData) return res.status(404).json({ error: '班级不存在' });

    const studentIds = classData.students.map(s => s.studentId);
    const studentCount = studentIds.length;
    const hwCount = classData.homeworks.length;

    // 1) Classroom QA average score (performance records of type CLASSROOM_QA, score 1-5 -> 0-100)
    const qaRecords = classData.performanceRecords.filter(r => r.type === 'CLASSROOM_QA' && r.score != null);
    const qaAvg = qaRecords.length > 0
      ? Math.round((qaRecords.reduce((sum, r) => sum + (r.score as number), 0) / qaRecords.length) / 5 * 100)
      : 0;

    // 2) Knowledge sharing average
    const shareRecords = classData.performanceRecords.filter(r => r.type === 'KNOWLEDGE_SHARE' && r.score != null);
    const shareAvg = shareRecords.length > 0
      ? Math.round((shareRecords.reduce((sum, r) => sum + (r.score as number), 0) / shareRecords.length) / 5 * 100)
      : 0;

    // 3) Homework score rate
    let totalHwScore = 0;
    let totalHwMaxScore = 0;
    for (const hw of classData.homeworks) {
      for (const sub of hw.submissions) {
        if (sub.score !== null && studentIds.includes(sub.studentId)) {
          totalHwScore += sub.score;
          totalHwMaxScore += hw.maxScore;
        }
      }
    }
    const hwScoreRate = totalHwMaxScore > 0 ? Math.round((totalHwScore / totalHwMaxScore) * 100) : 0;

    // 4) Submission rate
    let totalSubs = 0;
    const totalExpected = studentCount * hwCount;
    for (const hw of classData.homeworks) {
      totalSubs += hw.submissions.filter(s => studentIds.includes(s.studentId)).length;
    }
    const submissionRate = totalExpected > 0 ? Math.round((totalSubs / totalExpected) * 100) : 0;

    // 5) Peer review completion rate
    const totalPeerAssigned = classData.homeworks.reduce((sum, hw) => sum + hw.peerReviewAssignments.filter(a => studentIds.includes(a.reviewerId)).length, 0);
    const totalPeerDone = classData.homeworks.reduce((sum, hw) => sum + hw.peerReviews.filter(pr => studentIds.includes(pr.reviewerId)).length, 0);
    const peerCompletionRate = totalPeerAssigned > 0 ? Math.round((totalPeerDone / totalPeerAssigned) * 100) : 0;

    // 6) Self-assessment completion rate
    const groupHomeworks = classData.homeworks.filter(hw => hw.type === 'GROUP_PROJECT');
    const totalSelfExpected = groupHomeworks.length * studentCount;
    const totalSelfDone = classData.homeworks.reduce((sum, hw) => sum + hw.selfAssessments.filter(sa => studentIds.includes(sa.studentId)).length, 0);
    const selfCompletionRate = totalSelfExpected > 0 ? Math.round((totalSelfDone / totalSelfExpected) * 100) : 0;

    res.json({
      indicators: [
        { name: '课堂问答', value: qaAvg, fullMark: 100 },
        { name: '知识分享', value: shareAvg, fullMark: 100 },
        { name: '作业得分率', value: hwScoreRate, fullMark: 100 },
        { name: '提交率', value: submissionRate, fullMark: 100 },
        { name: '互评完成率', value: peerCompletionRate, fullMark: 100 },
        { name: '自评完成率', value: selfCompletionRate, fullMark: 100 },
      ],
    });
  } catch (error) {
    console.error('获取指标雷达失败:', error);
    res.status(500).json({ error: '获取指标雷达失败' });
  }
});

// 1C: KMeans聚类增强 (添加 ?method=kmeans&k=3 参数支持)
function kMeansCluster(data: number[][], k: number, maxIter = 100): { labels: number[]; centroids: number[][] } {
  const n = data.length;
  const dim = data[0]?.length ?? 0;
  if (n === 0 || dim === 0 || k <= 0) return { labels: [], centroids: [] };
  const clampK = Math.min(k, n);

  // Initialize centroids using first k distinct points
  const centroids: number[][] = [];
  const usedKeys = new Set<string>();
  for (let i = 0; i < n && centroids.length < clampK; i++) {
    const key = data[i].join(',');
    if (!usedKeys.has(key)) {
      centroids.push([...data[i]]);
      usedKeys.add(key);
    }
  }
  while (centroids.length < clampK) centroids.push([...data[centroids.length % n]]);

  let labels = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    const newLabels = data.map(point => {
      let minDist = Infinity;
      let bestC = 0;
      for (let c = 0; c < clampK; c++) {
        let dist = 0;
        for (let d = 0; d < dim; d++) dist += (point[d] - centroids[c][d]) ** 2;
        if (dist < minDist) { minDist = dist; bestC = c; }
      }
      return bestC;
    });

    // Check convergence
    if (newLabels.every((l, i) => l === labels[i])) { labels = newLabels; break; }
    labels = newLabels;

    // Update centroids
    for (let c = 0; c < clampK; c++) {
      const members = data.filter((_, i) => labels[i] === c);
      if (members.length === 0) continue;
      for (let d = 0; d < dim; d++) {
        centroids[c][d] = members.reduce((sum, p) => sum + p[d], 0) / members.length;
      }
    }
  }
  return { labels, centroids };
}

function silhouetteScore(data: number[][], labels: number[]): number {
  const n = data.length;
  if (n <= 1) return 0;
  const uniqueLabels = [...new Set(labels)];
  if (uniqueLabels.length <= 1) return 0;

  const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));

  let totalS = 0;
  for (let i = 0; i < n; i++) {
    const myCluster = labels[i];
    const sameCluster = data.filter((_, j) => j !== i && labels[j] === myCluster);
    const a = sameCluster.length > 0 ? sameCluster.reduce((s, p) => s + dist(data[i], p), 0) / sameCluster.length : 0;

    let minB = Infinity;
    for (const cl of uniqueLabels) {
      if (cl === myCluster) continue;
      const otherCluster = data.filter((_, j) => labels[j] === cl);
      if (otherCluster.length === 0) continue;
      const avgDist = otherCluster.reduce((s, p) => s + dist(data[i], p), 0) / otherCluster.length;
      if (avgDist < minB) minB = avgDist;
    }
    if (minB === Infinity) minB = 0;

    const s = Math.max(a, minB) > 0 ? (minB - a) / Math.max(a, minB) : 0;
    totalS += s;
  }
  return Math.round((totalS / n) * 1000) / 1000;
}

// Enhanced student-clusters endpoint: supports ?method=kmeans&k=3
router.get('/class/:classId/student-clusters', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const method = (req.query.method as string) || 'threshold';
    const k = parseInt(req.query.k as string) || 3;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { include: { student: { select: { id: true, name: true, email: true, avatar: true } } } },
        homeworks: { include: { submissions: true } },
      },
    });

    if (!classData) return res.status(404).json({ error: '班级不存在' });

    const studentCount = classData.students.length;
    const homeworkCount = classData.homeworks.length;

    const studentMetrics = classData.students.map((cs) => {
      let totalScore = 0;
      let totalMaxScore = 0;
      let submittedCount = 0;
      let onTimeCount = 0;

      for (const hw of classData.homeworks) {
        const sub = hw.submissions.find((s) => s.studentId === cs.studentId);
        if (sub) {
          submittedCount++;
          if (sub.score !== null) {
            totalScore += sub.score;
            totalMaxScore += hw.maxScore;
          }
          if (new Date(sub.submittedAt) <= new Date(hw.deadline)) {
            onTimeCount++;
          }
        }
      }

      const avgScoreRate = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
      const submissionRate = homeworkCount > 0 ? Math.round((submittedCount / homeworkCount) * 100) : 0;
      const onTimeRate = submittedCount > 0 ? Math.round((onTimeCount / submittedCount) * 100) : 0;

      const composite = avgScoreRate * CLUSTER_SCORE_WEIGHT + submissionRate * CLUSTER_SUBMISSION_WEIGHT + onTimeRate * CLUSTER_ONTIME_WEIGHT;

      return {
        student: cs.student,
        avgScoreRate,
        submissionRate,
        onTimeRate,
        composite: Math.round(composite),
      };
    });

    if (method === 'kmeans' && studentCount >= k) {
      const dataPoints = studentMetrics.map(m => [m.avgScoreRate, m.submissionRate, m.onTimeRate]);
      const { labels } = kMeansCluster(dataPoints, k);
      const score = silhouetteScore(dataPoints, labels);

      // Assign cluster labels based on centroid composite scores
      const clusterComposites: Record<number, number[]> = {};
      labels.forEach((l, i) => {
        if (!clusterComposites[l]) clusterComposites[l] = [];
        clusterComposites[l].push(studentMetrics[i].composite);
      });
      const clusterAvgs = Object.entries(clusterComposites).map(([cl, vals]) => ({
        cluster: parseInt(cl),
        avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      })).sort((a, b) => b.avg - a.avg);

      const clusterLabelMap: Record<number, 'HIGH' | 'MEDIUM' | 'AT_RISK'> = {};
      const labelNames: Array<'HIGH' | 'MEDIUM' | 'AT_RISK'> = ['HIGH', 'MEDIUM', 'AT_RISK'];
      clusterAvgs.forEach((c, i) => {
        clusterLabelMap[c.cluster] = labelNames[Math.min(i, labelNames.length - 1)];
      });

      const enriched = studentMetrics.map((m, i) => ({
        ...m,
        cluster: clusterLabelMap[labels[i]] || 'MEDIUM' as const,
      }));

      const clusters = {
        HIGH: enriched.filter((s) => s.cluster === 'HIGH'),
        MEDIUM: enriched.filter((s) => s.cluster === 'MEDIUM'),
        AT_RISK: enriched.filter((s) => s.cluster === 'AT_RISK'),
      };

      res.json({
        method: 'kmeans',
        k,
        silhouetteScore: score,
        clusters,
        summary: {
          highCount: clusters.HIGH.length,
          mediumCount: clusters.MEDIUM.length,
          atRiskCount: clusters.AT_RISK.length,
          highPercentage: studentCount > 0 ? Math.round((clusters.HIGH.length / studentCount) * 100) : 0,
          mediumPercentage: studentCount > 0 ? Math.round((clusters.MEDIUM.length / studentCount) * 100) : 0,
          atRiskPercentage: studentCount > 0 ? Math.round((clusters.AT_RISK.length / studentCount) * 100) : 0,
        },
        totalStudents: studentCount,
      });
    } else {
      // Threshold-based (original)
      const enriched = studentMetrics.map(m => {
        let cluster: 'HIGH' | 'MEDIUM' | 'AT_RISK';
        if (m.composite >= 80) cluster = 'HIGH';
        else if (m.composite >= 50) cluster = 'MEDIUM';
        else cluster = 'AT_RISK';
        return { ...m, cluster };
      });

      const clusters = {
        HIGH: enriched.filter((s) => s.cluster === 'HIGH'),
        MEDIUM: enriched.filter((s) => s.cluster === 'MEDIUM'),
        AT_RISK: enriched.filter((s) => s.cluster === 'AT_RISK'),
      };

      res.json({
        method: 'threshold',
        clusters,
        summary: {
          highCount: clusters.HIGH.length,
          mediumCount: clusters.MEDIUM.length,
          atRiskCount: clusters.AT_RISK.length,
          highPercentage: studentCount > 0 ? Math.round((clusters.HIGH.length / studentCount) * 100) : 0,
          mediumPercentage: studentCount > 0 ? Math.round((clusters.MEDIUM.length / studentCount) * 100) : 0,
          atRiskPercentage: studentCount > 0 ? Math.round((clusters.AT_RISK.length / studentCount) * 100) : 0,
        },
        totalStudents: studentCount,
      });
    }
  } catch (error) {
    console.error('获取学生聚类分析失败:', error);
    res.status(500).json({ error: '获取学生聚类分析失败' });
  }
});

// 1D: 课堂表现热力图
router.get('/class/:classId/performance-heatmap', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const students = await prisma.classStudent.findMany({
      where: { classId },
      include: { student: { select: { id: true, name: true } } },
    });

    const records = await prisma.classPerformanceRecord.findMany({
      where: { classId },
      select: { studentId: true, score: true, occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    });

    if (records.length === 0) {
      return res.json({
        students: students.map(s => ({ id: s.student.id, name: s.student.name })),
        timeBuckets: [],
        matrix: students.map(() => []),
      });
    }

    // Generate weekly time buckets
    const firstDate = new Date(records[0].occurredAt);
    const lastDate = new Date(records[records.length - 1].occurredAt);
    const timeBuckets: string[] = [];
    const bucketStart: Date[] = [];
    const current = new Date(firstDate);
    current.setDate(current.getDate() - current.getDay()); // Start of week
    current.setHours(0, 0, 0, 0);

    while (current <= lastDate) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const label = `${current.getMonth() + 1}/${current.getDate()}-${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
      timeBuckets.push(label);
      bucketStart.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }

    // Build matrix[student_index][time_bucket_index]
    const studentIdToIdx: Record<string, number> = {};
    students.forEach((s, i) => { studentIdToIdx[s.student.id] = i; });

    const matrix: number[][] = students.map(() => new Array(timeBuckets.length).fill(0));

    for (const r of records) {
      const sIdx = studentIdToIdx[r.studentId];
      if (sIdx === undefined) continue;
      const rDate = new Date(r.occurredAt);
      for (let b = 0; b < bucketStart.length; b++) {
        const bEnd = new Date(bucketStart[b]);
        bEnd.setDate(bEnd.getDate() + 7);
        if (rDate >= bucketStart[b] && rDate < bEnd) {
          matrix[sIdx][b] += r.score ?? 0;
          break;
        }
      }
    }

    res.json({
      students: students.map(s => ({ id: s.student.id, name: s.student.name })),
      timeBuckets,
      matrix,
    });
  } catch (error) {
    console.error('获取表现热力图失败:', error);
    res.status(500).json({ error: '获取表现热力图失败' });
  }
});

// 1E: 个体学生画像
router.get('/class/:classId/student/:studentId/profile', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, email: true, avatar: true },
    });
    if (!student) return res.status(404).json({ error: '学生不存在' });

    // Homework scores and trend
    const homeworks = await prisma.homework.findMany({
      where: { classId },
      include: { submissions: { where: { studentId } } },
      orderBy: { createdAt: 'asc' },
    });

    const homeworkScores = homeworks.map(hw => {
      const sub = hw.submissions[0];
      return {
        homeworkId: hw.id,
        title: hw.title,
        maxScore: hw.maxScore,
        score: sub?.score ?? null,
        submitted: !!sub,
        onTime: sub ? new Date(sub.submittedAt) <= new Date(hw.deadline) : false,
      };
    });

    // Performance records
    const perfRecords = await prisma.classPerformanceRecord.findMany({
      where: { classId, studentId },
      select: { type: true, topic: true, score: true, occurredAt: true },
      orderBy: { occurredAt: 'desc' },
    });
    const qaRecords = perfRecords.filter(r => r.type === 'CLASSROOM_QA');
    const shareRecords = perfRecords.filter(r => r.type === 'KNOWLEDGE_SHARE');

    // Self-assessment data
    const selfAssessments = await prisma.selfAssessment.findMany({
      where: { studentId, homework: { classId } },
      include: { homework: { select: { title: true } } },
    });

    // Peer reviews given and received
    const peerReviewsGiven = await prisma.peerReview.findMany({
      where: { reviewerId: studentId, homework: { classId } },
      select: { score: true, comment: true, homework: { select: { title: true } } },
    });
    const peerReviewsReceived = await prisma.peerReview.findMany({
      where: { submission: { studentId }, homework: { classId } },
      select: { score: true, comment: true, homework: { select: { title: true } } },
    });

    // Cluster classification
    const hwCount = homeworks.length;
    let totalScore = 0;
    let totalMaxScore = 0;
    let submittedCount = 0;
    let onTimeCount = 0;
    for (const hs of homeworkScores) {
      if (hs.submitted) {
        submittedCount++;
        if (hs.score !== null) {
          totalScore += hs.score;
          totalMaxScore += hs.maxScore;
        }
        if (hs.onTime) onTimeCount++;
      }
    }
    const avgScoreRate = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
    const submissionRate = hwCount > 0 ? Math.round((submittedCount / hwCount) * 100) : 0;
    const onTimeRate = submittedCount > 0 ? Math.round((onTimeCount / submittedCount) * 100) : 0;
    const composite = avgScoreRate * 0.5 + submissionRate * 0.3 + onTimeRate * 0.2;
    let cluster: 'HIGH' | 'MEDIUM' | 'AT_RISK';
    if (composite >= 80) cluster = 'HIGH';
    else if (composite >= 50) cluster = 'MEDIUM';
    else cluster = 'AT_RISK';

    res.json({
      student,
      homeworkScores,
      performance: {
        qa: { count: qaRecords.length, records: qaRecords },
        share: { count: shareRecords.length, records: shareRecords },
      },
      selfAssessments: selfAssessments.map(sa => ({
        homeworkTitle: sa.homework.title,
        score: sa.score,
        description: sa.description,
      })),
      peerReviews: {
        given: peerReviewsGiven.map(pr => ({ homeworkTitle: pr.homework.title, score: pr.score, comment: pr.comment })),
        received: peerReviewsReceived.map(pr => ({ homeworkTitle: pr.homework.title, score: pr.score, comment: pr.comment })),
      },
      metrics: { avgScoreRate, submissionRate, onTimeRate, composite: Math.round(composite), cluster },
    });
  } catch (error) {
    console.error('获取学生画像失败:', error);
    res.status(500).json({ error: '获取学生画像失败' });
  }
});

// 1F: 自评/互评数据统计
router.get('/class/:classId/peer-review-stats', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const studentIds = (await prisma.classStudent.findMany({
      where: { classId }, select: { studentId: true },
    })).map(s => s.studentId);

    const homeworks = await prisma.homework.findMany({
      where: { classId },
      include: {
        selfAssessments: { where: { studentId: { in: studentIds } } },
        peerReviews: true,
        submissions: { where: { studentId: { in: studentIds }, score: { not: null } } },
      },
    });

    // Self-assessment distribution
    const selfScores = homeworks.flatMap(hw => hw.selfAssessments.map(sa => sa.score));
    const selfDistribution: Record<string, number> = {};
    for (const s of selfScores) {
      const base = Math.floor(s / 10) * 10;
      const bucket = `${base}-${base + 9}`;
      selfDistribution[bucket] = (selfDistribution[bucket] ?? 0) + 1;
    }

    // Peer review distribution
    const peerScores = homeworks.flatMap(hw => hw.peerReviews.map(pr => pr.score));
    const peerDistribution: Record<string, number> = {};
    for (const s of peerScores) {
      const base = Math.floor(s / 10) * 10;
      const bucket = `${base}-${base + 9}`;
      peerDistribution[bucket] = (peerDistribution[bucket] ?? 0) + 1;
    }

    // Self vs Teacher scatter data
    const scatterData: Array<{ selfScore: number; teacherScore: number; studentId: string }> = [];
    for (const hw of homeworks) {
      for (const sa of hw.selfAssessments) {
        const submission = hw.submissions.find(s => s.studentId === sa.studentId);
        if (submission && submission.score !== null) {
          scatterData.push({
            selfScore: sa.score,
            teacherScore: Math.round((submission.score / hw.maxScore) * 100),
            studentId: sa.studentId,
          });
        }
      }
    }

    // Peer review consistency (standard deviation of peer scores per submission)
    const peerScoresBySubmission: Record<string, number[]> = {};
    for (const hw of homeworks) {
      for (const pr of hw.peerReviews) {
        const key = pr.submissionId;
        if (!peerScoresBySubmission[key]) peerScoresBySubmission[key] = [];
        peerScoresBySubmission[key].push(pr.score);
      }
    }
    const stdDevs = Object.values(peerScoresBySubmission)
      .filter(arr => arr.length > 1)
      .map(arr => {
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        return Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);
      });
    const avgStdDev = stdDevs.length > 0 ? Math.round((stdDevs.reduce((a, b) => a + b, 0) / stdDevs.length) * 10) / 10 : 0;

    res.json({
      selfAssessment: {
        totalCount: selfScores.length,
        distribution: Object.entries(selfDistribution)
          .map(([range, count]) => ({ range, count }))
          .sort((a, b) => a.range.localeCompare(b.range)),
        average: selfScores.length > 0 ? Math.round(selfScores.reduce((a, b) => a + b, 0) / selfScores.length) : 0,
      },
      peerReview: {
        totalCount: peerScores.length,
        distribution: Object.entries(peerDistribution)
          .map(([range, count]) => ({ range, count }))
          .sort((a, b) => a.range.localeCompare(b.range)),
        average: peerScores.length > 0 ? Math.round(peerScores.reduce((a, b) => a + b, 0) / peerScores.length) : 0,
        consistencyStdDev: avgStdDev,
      },
      selfVsTeacher: scatterData,
    });
  } catch (error) {
    console.error('获取评价分析数据失败:', error);
    res.status(500).json({ error: '获取评价分析数据失败' });
  }
});

export default router;
