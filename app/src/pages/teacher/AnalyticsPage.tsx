import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useClassStore } from '@/stores/classStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart as BaseBarChart } from '@/components/charts/BarChart';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar, ScatterChart, Scatter, ZAxis, Legend, LineChart, Line, Area, AreaChart, RadarChart as ReRadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { AlertTriangle, Award, Sparkles, Users, TrendingUp, Target, Grid3X3, Flame, BarChart3, CloudCog } from 'lucide-react';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

interface AIReport {
  classId: string;
  generatedAt: string;
  submissionRate: number;
  latestHomeworkInsights: { homeworkId: string; title: string; submitRate: number; avgScore: number }[];
  summary: string;
}

export function AnalyticsPage() {
  const { classes, fetchTeacherClasses } = useClassStore();
  const {
    homeworkStats, scoreDistribution, classOverview, studentClusters, scatterData, comprehensiveStats,
    scoreHeatmap, engagementBubbles, studentTrends, competencyKeywords,
    isLoading, fetchClassHomeworkStats, fetchScoreDistribution, fetchClassOverview,
    fetchStudentClusters, fetchPerformanceScatter, fetchComprehensiveStats,
    fetchScoreHeatmap, fetchEngagementBubbles, fetchStudentTrends, fetchCompetencyKeywords,
  } = useAnalyticsStore();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedHomeworkId, setSelectedHomeworkId] = useState('');
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [trendCompare, setTrendCompare] = useState<Array<{ homeworkTitle: string; averagePercentage: number }>>([]);
  const [groupCompare, setGroupCompare] = useState<Array<{ groupName: string; averagePercentage: number }>>([]);

  useEffect(() => {
    fetchTeacherClasses();
  }, []);

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) setSelectedClassId(classes[0].id);
  }, [classes]);

  useEffect(() => {
    if (!selectedClassId) return;
    Promise.all([
      fetchClassHomeworkStats(selectedClassId),
      fetchClassOverview(selectedClassId),
      fetchStudentClusters(selectedClassId),
      fetchPerformanceScatter(selectedClassId),
      fetchComprehensiveStats(selectedClassId),
      fetchScoreHeatmap(selectedClassId),
      fetchEngagementBubbles(selectedClassId),
      fetchStudentTrends(selectedClassId),
      fetchCompetencyKeywords(selectedClassId),
    ]);
  }, [selectedClassId]);

  useEffect(() => {
    if (homeworkStats.length > 0 && !selectedHomeworkId) setSelectedHomeworkId(homeworkStats[0].id);
  }, [homeworkStats]);

  useEffect(() => {
    if (!selectedHomeworkId) return;
    fetchScoreDistribution(selectedHomeworkId);
  }, [selectedHomeworkId]);

  const loadAdvanced = async () => {
    if (!selectedClassId) return;
    const [reportRes, trendRes] = await Promise.all([
      api.get(`/analytics/class/${selectedClassId}/ai-report`),
      api.get(`/analytics/class/${selectedClassId}/trend-compare`),
    ]);
    setAiReport(reportRes.data.report || null);
    setTrendCompare((trendRes.data.trend || []).map((t: any) => ({ homeworkTitle: t.homeworkTitle, averagePercentage: t.averagePercentage })));

    if (selectedHomeworkId) {
      const groupRes = await api.get(`/analytics/homework/${selectedHomeworkId}/group-compare`);
      setGroupCompare((groupRes.data.groups || []).map((g: any) => ({ groupName: g.groupName, averagePercentage: g.averagePercentage })));
    }
  };

  useEffect(() => {
    if (selectedClassId) loadAdvanced();
  }, [selectedClassId, selectedHomeworkId]);

  const homeworkOptions = useMemo(() => homeworkStats.map((h) => ({ id: h.id, title: h.title })), [homeworkStats]);

  const clusterBadge = (cluster: string) => {
    if (cluster === 'HIGH') return <Badge className="bg-green-100 text-green-700">优秀</Badge>;
    if (cluster === 'MEDIUM') return <Badge className="bg-yellow-100 text-yellow-700">中等</Badge>;
    return <Badge className="bg-red-100 text-red-700">待关注</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">数据分析</h1>
          <p className="mt-1 text-sm text-muted-foreground">班级 / 作业联动分析、学生聚类、成绩分布与 AI 学情报告。</p>
        </div>
        <div className="flex gap-2">
          <select className="rounded-md border px-3 py-2" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="rounded-md border px-3 py-2" value={selectedHomeworkId} onChange={(e) => setSelectedHomeworkId(e.target.value)}>
            {homeworkOptions.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
          </select>
          <Button variant="outline" onClick={loadAdvanced}><Sparkles className="mr-2 h-4 w-4" />刷新 AI 报告</Button>
        </div>
      </div>

      {/* 综合统计卡片 */}
      {comprehensiveStats && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">学生人数</p><p className="text-2xl font-bold">{comprehensiveStats.overview.studentCount}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">平均分</p><p className="text-2xl font-bold text-green-700">{comprehensiveStats.overview.avgScore}%</p><p className="text-xs text-muted-foreground mt-1">中位数 {comprehensiveStats.overview.medianScore}% · 标准差 {comprehensiveStats.overview.stdDev}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">及格率 / 优秀率</p><p className="text-2xl font-bold text-blue-700">{comprehensiveStats.overview.passRate}% / {comprehensiveStats.overview.excellentRate}%</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">作业数 / 总评分</p><p className="text-2xl font-bold">{comprehensiveStats.overview.homeworkCount} / {comprehensiveStats.overview.totalScored}</p></CardContent></Card>
        </div>
      )}

      {/* 学生聚类分析 */}
      {studentClusters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />学生聚类分析</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-sm text-green-700 font-medium">优秀学生</p>
                <p className="text-3xl font-bold text-green-800">{studentClusters.summary.highCount}</p>
                <p className="text-xs text-green-600">{studentClusters.summary.highPercentage}% · 综合得分 ≥80</p>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
                <p className="text-sm text-yellow-700 font-medium">中等学生</p>
                <p className="text-3xl font-bold text-yellow-800">{studentClusters.summary.mediumCount}</p>
                <p className="text-xs text-yellow-600">{studentClusters.summary.mediumPercentage}% · 综合得分 50-79</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-sm text-red-700 font-medium">待关注学生</p>
                <p className="text-3xl font-bold text-red-800">{studentClusters.summary.atRiskCount}</p>
                <p className="text-xs text-red-600">{studentClusters.summary.atRiskPercentage}% · 综合得分 {'<'}50</p>
              </div>
            </div>
            {/* Cluster ring chart */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: '优秀', value: studentClusters.summary.highCount },
                        { name: '中等', value: studentClusters.summary.mediumCount },
                        { name: '待关注', value: studentClusters.summary.atRiskCount },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...studentClusters.clusters.AT_RISK, ...studentClusters.clusters.MEDIUM, ...studentClusters.clusters.HIGH]
                  .sort((a, b) => a.composite - b.composite)
                  .slice(0, 10)
                  .map((s) => (
                    <div key={s.student.id} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span className="font-medium">{s.student.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">得分率{s.avgScoreRate}% · 提交率{s.submissionRate}%</span>
                        {clusterBadge(s.cluster)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 学生表现散点图 + 综合成绩分布 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {scatterData && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" />学生表现散点图</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name={scatterData.xLabel} domain={[0, 100]} unit="%" />
                  <YAxis type="number" dataKey="y" name={scatterData.yLabel} domain={[0, 100]} unit="%" />
                  <ZAxis range={[40, 200]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: number, name: string) => [`${value}%`, name === 'x' ? '提交率' : '得分率']} />
                  <Scatter name="学生" data={scatterData.points} fill="#3b82f6" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {comprehensiveStats && (
          <Card>
            <CardHeader><CardTitle>综合成绩分布</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={comprehensiveStats.scoreDistribution}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={100}
                    label={({ label, percentage }) => `${label}: ${percentage}%`}
                  >
                    {comprehensiveStats.scoreDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 作业提交率 + 单次作业成绩分布 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>作业提交率</CardTitle></CardHeader>
          <CardContent className="h-80">
            <BaseBarChart data={homeworkStats.map((h) => ({ name: h.title.slice(0, 8), value: h.statistics.submissionRate }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>单次作业成绩分布</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={scoreDistribution || []} dataKey="count" nameKey="label" outerRadius={100}>
                  {(scoreDistribution || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 作业趋势：平均分/最高分/最低分 */}
      {comprehensiveStats && comprehensiveStats.homeworkTrend.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />作业成绩趋势（均分/最高/最低）</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comprehensiveStats.homeworkTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg" name="平均分" stroke="#3b82f6" strokeWidth={2} dot />
                <Line type="monotone" dataKey="highest" name="最高分" stroke="#22c55e" strokeWidth={1} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="lowest" name="最低分" stroke="#ef4444" strokeWidth={1} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 班级概览 */}
      <Card>
        <CardHeader><CardTitle>班级概览</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 font-medium">高分学生</p>
            <div className="space-y-2">{classOverview?.topStudents.map((s) => <div key={s.id} className="rounded border p-2 text-sm">{s.name} · 总分 {s.totalScore}</div>)}</div>
          </div>
          <div>
            <p className="mb-2 font-medium">需关注学生</p>
            <div className="space-y-2">{classOverview?.needAttention.map((s) => <div key={s.id} className="rounded border p-2 text-sm">{s.name} · 总分 {s.totalScore}</div>)}</div>
          </div>
        </CardContent>
      </Card>

      {/* AI 学情分析报告 */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" />AI 学情分析报告</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700">{aiReport?.summary || '暂无报告'}</p>
          <div className="mt-3 space-y-2 text-sm">
            {aiReport?.latestHomeworkInsights.map((h) => (
              <div key={h.homeworkId} className="rounded border bg-white p-2">{h.title} · 提交率 {h.submitRate}% · 均分 {h.avgScore}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 趋势对比 + 分组对比 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>成绩趋势对比</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendCompare}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="homeworkTitle" hide />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="averagePercentage" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>分组成绩对比</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupCompare}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="groupName" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="averagePercentage" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ===== 深度数据分析（EduAnalytics 参考） ===== */}
      <div className="border-t pt-6 mt-2">
        <h2 className="text-xl font-bold text-slate-900 mb-1">深度数据分析</h2>
        <p className="text-sm text-muted-foreground mb-4">多维度可视化洞察，参考 EduAnalytics 数据分析模型，所有数据来自数据库实时聚合。</p>
      </div>

      {/* 学习参与度气泡图 + 能力关键词雷达 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {engagementBubbles && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" />学习参与度气泡图</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name={engagementBubbles.xLabel} domain={[0, 100]} unit="%" label={{ value: '提交率', position: 'insideBottom', offset: -5, fontSize: 12 }} />
                  <YAxis type="number" dataKey="y" name={engagementBubbles.yLabel} domain={[0, 100]} unit="%" label={{ value: '得分率', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                  <ZAxis type="number" dataKey="z" range={[40, 400]} name={engagementBubbles.zLabel} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg bg-white p-3 shadow-lg border text-sm">
                        <p className="font-medium">{d.name}</p>
                        <p className="text-slate-600">提交率: {d.x}%</p>
                        <p className="text-slate-600">得分率: {d.y}%</p>
                        <p className="text-slate-600">活跃度: {d.z}</p>
                      </div>
                    );
                  }} />
                  <Scatter name="学生" data={engagementBubbles.bubbles} fill="#8b5cf6" fillOpacity={0.6} />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {competencyKeywords && competencyKeywords.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CloudCog className="h-4 w-4 text-blue-500" />班级能力关键词分析</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ReRadarChart cx="50%" cy="50%" outerRadius="65%" data={competencyKeywords.map(k => ({ subject: k.name, value: k.value, fullMark: 100 }))}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="班级能力" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip />
                </ReRadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 成绩热力图 */}
      {scoreHeatmap && scoreHeatmap.students.length > 0 && scoreHeatmap.homeworks.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Grid3X3 className="h-4 w-4 text-emerald-500" />学生成绩热力图</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-3 text-left font-medium text-slate-600 sticky left-0 bg-white">学生</th>
                    {scoreHeatmap.homeworks.map(hw => (
                      <th key={hw.id} className="py-2 px-2 text-center font-medium text-slate-600 max-w-[80px] truncate" title={hw.title}>{hw.title.slice(0, 6)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scoreHeatmap.students.map(student => (
                    <tr key={student.id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-medium text-slate-800 sticky left-0 bg-white">{student.name}</td>
                      {student.scores.map((score, i) => {
                        let bgColor = 'bg-slate-50';
                        let textColor = 'text-slate-400';
                        if (score !== null) {
                          if (score >= 90) { bgColor = 'bg-green-100'; textColor = 'text-green-800'; }
                          else if (score >= 80) { bgColor = 'bg-green-50'; textColor = 'text-green-700'; }
                          else if (score >= 70) { bgColor = 'bg-yellow-50'; textColor = 'text-yellow-700'; }
                          else if (score >= 60) { bgColor = 'bg-orange-50'; textColor = 'text-orange-700'; }
                          else { bgColor = 'bg-red-50'; textColor = 'text-red-700'; }
                        }
                        return (
                          <td key={i} className={`py-2 px-2 text-center text-xs font-medium ${bgColor} ${textColor}`}>
                            {score !== null ? `${score}%` : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100" />≥90 优秀</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border" />80-89 良好</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-50 border" />70-79 中等</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-50 border" />60-69 及格</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border" />{'<'}60 不及格</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 多学生成绩趋势对比 (叠加面积图) */}
      {studentTrends && studentTrends.trendData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-violet-500" />多学生成绩趋势对比</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={studentTrends.trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="homework" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {/* Limit to 10 students to maintain chart readability and color distinction */}
                {studentTrends.studentNames.slice(0, 10).map((name, i) => {
                  const areaColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'];
                  return (
                    <Area
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={areaColors[i % areaColors.length]}
                      fill={areaColors[i % areaColors.length]}
                      fillOpacity={0.1}
                      strokeWidth={1.5}
                      connectNulls
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">加载中...</p>}
    </div>
  );
}
