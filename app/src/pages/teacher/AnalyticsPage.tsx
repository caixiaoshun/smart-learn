import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useClassStore } from '@/stores/classStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart as BaseBarChart } from '@/components/charts/BarChart';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar, ScatterChart, Scatter, ZAxis, Legend, LineChart, Line } from 'recharts';
import { AlertTriangle, Award, Sparkles, Users, TrendingUp, Target } from 'lucide-react';

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
    isLoading, fetchClassHomeworkStats, fetchScoreDistribution, fetchClassOverview,
    fetchStudentClusters, fetchPerformanceScatter, fetchComprehensiveStats,
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

      {isLoading && <p className="text-sm text-muted-foreground">加载中...</p>}
    </div>
  );
}
