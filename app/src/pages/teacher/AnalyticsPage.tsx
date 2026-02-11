import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useClassStore } from '@/stores/classStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart as BaseBarChart } from '@/components/charts/BarChart';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { AlertTriangle, Award, FileCheck, Sparkles, Users } from 'lucide-react';

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
  const { homeworkStats, scoreDistribution, classOverview, isLoading, fetchClassHomeworkStats, fetchScoreDistribution, fetchClassOverview } = useAnalyticsStore();

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
    Promise.all([fetchClassHomeworkStats(selectedClassId), fetchClassOverview(selectedClassId)]);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">数据分析</h1>
          <p className="mt-1 text-sm text-muted-foreground">班级 / 作业联动分析、成绩分布与 AI 学情报告。</p>
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

      {classOverview && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">学生人数</p><p className="text-2xl font-bold">{classOverview.class.studentCount}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">总体提交率</p><p className="text-2xl font-bold text-blue-700">{classOverview.overview.overallSubmissionRate}%</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">平均分</p><p className="text-2xl font-bold text-green-700">{classOverview.overview.averageScore}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">作业数</p><p className="text-2xl font-bold">{classOverview.class.homeworkCount}</p></CardContent></Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>作业提交率</CardTitle></CardHeader>
          <CardContent className="h-80">
            <BaseBarChart data={homeworkStats.map((h) => ({ name: h.title.slice(0, 8), value: h.statistics.submissionRate }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>成绩分布</CardTitle></CardHeader>
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
