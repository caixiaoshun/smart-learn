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

// 学生聚类分析 (inspired by EduAnalytics studentCluster)
router.get('/class/:classId/student-clusters', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
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

    // Build per-student metrics
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

      // Simple clustering based on composite score
      const composite = avgScoreRate * CLUSTER_SCORE_WEIGHT + submissionRate * CLUSTER_SUBMISSION_WEIGHT + onTimeRate * CLUSTER_ONTIME_WEIGHT;
      let cluster: 'HIGH' | 'MEDIUM' | 'AT_RISK';
      if (composite >= 80) cluster = 'HIGH';
      else if (composite >= 50) cluster = 'MEDIUM';
      else cluster = 'AT_RISK';

      return {
        student: cs.student,
        avgScoreRate,
        submissionRate,
        onTimeRate,
        composite: Math.round(composite),
        cluster,
      };
    });

    // Group by cluster
    const clusters = {
      HIGH: studentMetrics.filter((s) => s.cluster === 'HIGH'),
      MEDIUM: studentMetrics.filter((s) => s.cluster === 'MEDIUM'),
      AT_RISK: studentMetrics.filter((s) => s.cluster === 'AT_RISK'),
    };

    const clusterSummary = {
      highCount: clusters.HIGH.length,
      mediumCount: clusters.MEDIUM.length,
      atRiskCount: clusters.AT_RISK.length,
      highPercentage: studentCount > 0 ? Math.round((clusters.HIGH.length / studentCount) * 100) : 0,
      mediumPercentage: studentCount > 0 ? Math.round((clusters.MEDIUM.length / studentCount) * 100) : 0,
      atRiskPercentage: studentCount > 0 ? Math.round((clusters.AT_RISK.length / studentCount) * 100) : 0,
    };

    res.json({ clusters, summary: clusterSummary, totalStudents: studentCount });
  } catch (error) {
    console.error('获取学生聚类分析失败:', error);
    res.status(500).json({ error: '获取学生聚类分析失败' });
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

// 学生成绩热力图（每个学生在每次作业中的得分率）
router.get('/class/:classId/score-heatmap', authenticate, requireTeacher, async (req, res) => {
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

    const homeworks = classData.homeworks.map(hw => ({ id: hw.id, title: hw.title }));
    const students = classData.students.map(cs => {
      const scores = classData.homeworks.map(hw => {
        const sub = hw.submissions.find(s => s.studentId === cs.studentId);
        if (!sub || sub.score === null) return null;
        return hw.maxScore > 0 ? Math.round((sub.score / hw.maxScore) * 100) : 0;
      });
      return { id: cs.student.id, name: cs.student.name, scores };
    });

    res.json({ homeworks, students });
  } catch (error) {
    console.error('获取成绩热力图失败:', error);
    res.status(500).json({ error: '获取成绩热力图失败' });
  }
});

// 多维学习参与度（气泡图数据：提交率 vs 得分率 vs 行为活跃度）
router.get('/class/:classId/engagement-bubble', authenticate, requireTeacher, async (req, res) => {
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

    const studentIds = classData.students.map(cs => cs.studentId);
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const behaviorLogs = await prisma.behaviorLog.findMany({
      where: { studentId: { in: studentIds }, createdAt: { gte: thirtyDaysAgo } },
      select: { studentId: true, duration: true },
    });
    const behaviorMap = new Map<string, number>();
    for (const log of behaviorLogs) {
      behaviorMap.set(log.studentId, (behaviorMap.get(log.studentId) || 0) + log.duration);
    }
    const maxBehavior = Math.max(...behaviorMap.values(), 1);

    const homeworkCount = classData.homeworks.length;
    const bubbles = classData.students.map(cs => {
      let totalScore = 0;
      let totalMaxScore = 0;
      let submittedCount = 0;

      for (const hw of classData.homeworks) {
        const sub = hw.submissions.find(s => s.studentId === cs.studentId);
        if (sub) {
          submittedCount++;
          if (sub.score !== null) {
            totalScore += sub.score;
            totalMaxScore += hw.maxScore;
          }
        }
      }

      const submissionRate = homeworkCount > 0 ? Math.round((submittedCount / homeworkCount) * 100) : 0;
      const scoreRate = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
      const activityDuration = behaviorMap.get(cs.studentId) || 0;
      const activityScore = Math.round((activityDuration / maxBehavior) * 100);

      return {
        name: cs.student.name,
        studentId: cs.student.id,
        x: submissionRate,
        y: scoreRate,
        z: activityScore,
      };
    });

    res.json({
      bubbles,
      xLabel: '提交率 (%)',
      yLabel: '平均得分率 (%)',
      zLabel: '学习活跃度',
    });
  } catch (error) {
    console.error('获取学习参与度气泡图失败:', error);
    res.status(500).json({ error: '获取学习参与度气泡图失败' });
  }
});

// 多学生成绩趋势对比（叠加面积图）
router.get('/class/:classId/student-trends', authenticate, requireTeacher, async (req, res) => {
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

    const homeworks = classData.homeworks.map(hw => ({ id: hw.id, title: hw.title }));

    // Build data points for each homework, include each student's score
    const trendData = classData.homeworks.map(hw => {
      const point: Record<string, string | number> = { homework: hw.title };
      for (const cs of classData.students) {
        const sub = hw.submissions.find(s => s.studentId === cs.studentId);
        if (sub && sub.score !== null) {
          point[cs.student.name] = hw.maxScore > 0 ? Math.round((sub.score / hw.maxScore) * 100) : 0;
        }
      }
      return point;
    });

    const studentNames = classData.students.map(cs => cs.student.name);

    res.json({ homeworks, trendData, studentNames });
  } catch (error) {
    console.error('获取多学生成绩趋势失败:', error);
    res.status(500).json({ error: '获取多学生成绩趋势失败' });
  }
});

// 学习能力关键词分析（词云数据）
router.get('/class/:classId/competency-keywords', authenticate, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const permission = await ensureClassOwner(classId, req.user!.userId);
    if (!permission.ok) return rejectPermission(res, permission as { code: number; error: string });

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { include: { student: { select: { id: true } } } },
        homeworks: {
          include: { submissions: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!classData) return res.status(404).json({ error: '班级不存在' });

    const studentIds = classData.students.map(cs => cs.studentId);
    const studentCount = studentIds.length;
    const homeworkCount = classData.homeworks.length;

    // Compute aggregate metrics
    let totalSubmissions = 0;
    let totalScored = 0;
    let totalScore = 0;
    let totalMaxScore = 0;
    let onTimeCount = 0;
    let lateCount = 0;

    for (const hw of classData.homeworks) {
      for (const sub of hw.submissions) {
        if (!studentIds.includes(sub.studentId)) continue;
        totalSubmissions++;
        if (sub.score !== null) {
          totalScored++;
          totalScore += sub.score;
          totalMaxScore += hw.maxScore;
        }
        if (new Date(sub.submittedAt) <= new Date(hw.deadline)) {
          onTimeCount++;
        } else {
          lateCount++;
        }
      }
    }

    const avgScoreRate = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
    const submissionRate = (studentCount * homeworkCount) > 0 ? Math.round((totalSubmissions / (studentCount * homeworkCount)) * 100) : 0;
    const onTimeRate = totalSubmissions > 0 ? Math.round((onTimeCount / totalSubmissions) * 100) : 0;

    // Peer review stats
    const peerReviewCount = await prisma.peerReview.count({ where: { reviewerId: { in: studentIds } } });
    const groupMemberCount = await prisma.assignmentGroupMember.count({ where: { studentId: { in: studentIds } } });

    // Behavior logs
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const behaviorLogs = await prisma.behaviorLog.findMany({
      where: { studentId: { in: studentIds }, createdAt: { gte: thirtyDaysAgo } },
      select: { type: true, duration: true },
    });

    const resourceViews = behaviorLogs.filter(l => l.type === 'RESOURCE_VIEW').length;
    const caseViews = behaviorLogs.filter(l => l.type === 'CASE_VIEW').length;
    const aiChats = behaviorLogs.filter(l => l.type === 'AI_CHAT').length;
    const totalActivity = behaviorLogs.reduce((sum, l) => sum + l.duration, 0);

    // Performance records
    const perfRecords = await prisma.classPerformanceRecord.findMany({
      where: { studentId: { in: studentIds }, classId },
      select: { type: true, score: true },
    });
    const qaCount = perfRecords.filter(r => r.type === 'CLASSROOM_QA').length;
    const sharingCount = perfRecords.filter(r => r.type === 'KNOWLEDGE_SHARING').length;

    // Build keyword weights based on actual data
    const keywords: { name: string; value: number }[] = [
      { name: '知识掌握', value: avgScoreRate },
      { name: '作业完成', value: submissionRate },
      { name: '按时提交', value: onTimeRate },
      { name: '编程实践', value: Math.min(100, Math.round(totalActivity / Math.max(studentCount, 1) / 36)) },
      { name: '互评参与', value: Math.min(100, Math.round(peerReviewCount / Math.max(studentCount, 1) * 20)) },
      { name: '团队协作', value: Math.min(100, Math.round(groupMemberCount / Math.max(studentCount, 1) * 25)) },
      { name: '课堂问答', value: Math.min(100, Math.round(qaCount / Math.max(studentCount, 1) * 15)) },
      { name: '知识分享', value: Math.min(100, Math.round(sharingCount / Math.max(studentCount, 1) * 15)) },
      { name: '资源浏览', value: Math.min(100, Math.round(resourceViews / Math.max(studentCount, 1) * 10)) },
      { name: '案例学习', value: Math.min(100, Math.round(caseViews / Math.max(studentCount, 1) * 10)) },
      { name: 'AI互动', value: Math.min(100, Math.round(aiChats / Math.max(studentCount, 1) * 10)) },
      { name: '学习活跃度', value: Math.min(100, Math.round(totalActivity / Math.max(studentCount, 1) / 60)) },
      { name: '成绩优秀率', value: totalScored > 0 ? Math.round((totalScore / totalMaxScore) * 100 >= 90 ? 100 : (totalScore / totalMaxScore) * 100) : 0 },
      { name: '自主学习', value: Math.min(100, Math.round((resourceViews + caseViews + aiChats) / Math.max(studentCount, 1) * 8)) },
      { name: '迟交管理', value: lateCount > 0 ? Math.max(10, 100 - Math.round(lateCount / Math.max(totalSubmissions, 1) * 100)) : submissionRate > 0 ? 90 : 0 },
    ];

    res.json({ keywords });
  } catch (error) {
    console.error('获取能力关键词失败:', error);
    res.status(500).json({ error: '获取能力关键词失败' });
  }
});

export default router;
