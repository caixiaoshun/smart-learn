import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useTeacherStore } from '@/stores/teacherStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BarChart } from '@/components/charts/BarChart';
import { RadarChart } from '@/components/charts/RadarChart';
import { Download, Search, Sparkles, Users, AlertTriangle, CheckCircle, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface BehaviorOverview {
  summary: {
    totalStudents: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    avgBehaviorScore: number;
    updatedAt: string;
  };
  activityTrend: { name: string; value: number }[];
  abilityRadar: { subject: string; value: number; fullMark: number }[];
}

export function BehaviorAnalysisPage() {
  const { students, fetchStudents } = useTeacherStore();
  const [overview, setOverview] = useState<BehaviorOverview | null>(null);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      await fetchStudents();
      const { data } = await api.get('/behavior/teacher/overview');
      setOverview(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (riskFilter !== 'ALL' && student.riskLevel !== riskFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return student.studentName.toLowerCase().includes(q) || student.studentId.toLowerCase().includes(q);
    });
  }, [students, search, riskFilter]);

  const getRiskBadge = (level: string) => {
    if (level === 'HIGH') return <Badge className="bg-red-100 text-red-700">高风险</Badge>;
    if (level === 'MEDIUM') return <Badge className="bg-yellow-100 text-yellow-700">中风险</Badge>;
    return <Badge className="bg-green-100 text-green-700">低风险</Badge>;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get('/behavior/teacher/export', { params: { format: 'csv' }, responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `学生行为分析-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('报表导出成功');
    } finally {
      setIsExporting(false);
    }
  };

  const buildInterventionMessage = (student: typeof students[0]) => {
    const parts: string[] = [];
    if (student.behaviorScore < 50) parts.push(`您当前的学习行为评分为${student.behaviorScore.toFixed(1)}分，处于高风险区间`);
    else if (student.behaviorScore < 80) parts.push(`您当前的学习行为评分为${student.behaviorScore.toFixed(1)}分，存在下滑趋势`);
    if (student.quizAvg < 60) parts.push(`测验均分仅${student.quizAvg}%，建议加强知识点复习`);
    if (student.codingHours < 1) parts.push('近期编程实践时长不足，请增加动手练习');
    if (student.discussionPosts < 3) parts.push('课程讨论参与较少，建议多与同学和AI助手交流');
    if (parts.length === 0) return `${student.studentName}同学，请继续保持良好的学习状态，期待你更优异的表现！`;
    return `${student.studentName}同学，${parts.join('；')}。请及时调整学习计划并联系任课教师获得支持。`;
  };

  const handleApplyIntervention = async () => {
    const target = students.find((s) => s.riskLevel === 'HIGH') || students[0];
    if (!target) {
      toast.error('暂无可干预学生');
      return;
    }
    setIsApplying(true);
    try {
      await api.post(`/behavior/teacher/interventions/${target.id}/remind`, {
        message: buildInterventionMessage(target),
      });
      toast.success(`已向 ${target.studentName} 发送提醒`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">学生行为数据分析</h1>
          <p className="mt-1 text-sm text-slate-600">图表与风险数据均来自后端行为分析 API 聚合结果。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />导出报表
          </Button>
          <Button onClick={handleApplyIntervention} disabled={isApplying} className="bg-blue-600 hover:bg-blue-700">
            <Sparkles className="mr-2 h-4 w-4" />应用干预措施
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs text-slate-500">学生总数</p><p className="mt-2 text-2xl font-semibold">{overview?.summary.totalStudents ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-slate-500">待干预预警</p><p className="mt-2 text-2xl font-semibold text-red-600">{overview?.summary.highRiskCount ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-slate-500">中风险</p><p className="mt-2 text-2xl font-semibold text-amber-600">{overview?.summary.mediumRiskCount ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-slate-500">平均行为分</p><p className="mt-2 text-2xl font-semibold text-blue-700">{overview?.summary.avgBehaviorScore ?? 0}</p></CardContent></Card>
      </div>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-5 flex items-start gap-3">
          <div className="rounded-xl bg-blue-100 p-2"><Sparkles className="h-5 w-5 text-blue-600" /></div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">AI 洞察：学情风险分析</p>
            <p className="text-sm text-slate-600">
              {overview ? (() => {
                const { highRiskCount, mediumRiskCount, totalStudents, avgBehaviorScore } = overview.summary;
                if (highRiskCount > 0) return `检测到 ${highRiskCount} 名高风险学生（占比 ${totalStudents > 0 ? Math.round((highRiskCount / totalStudents) * 100) : 0}%），平均行为分 ${avgBehaviorScore}，建议优先推送学习资源并发送学习提醒。`;
                if (mediumRiskCount > 0) return `当前无高风险学生，但有 ${mediumRiskCount} 名中风险学生需要关注。整体行为分 ${avgBehaviorScore}，建议持续跟进学习进度。`;
                return `当前班级学习状态良好，${totalStudents} 名学生均为低风险，平均行为分 ${avgBehaviorScore}。建议适当增加挑战任务。`;
              })() : '正在分析学生行为数据...'}
            </p>
            <p className="mt-1 text-xs text-slate-500">最近更新：{overview?.summary.updatedAt ? new Date(overview.summary.updatedAt).toLocaleString('zh-CN') : '--'}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>近10天活动趋势</CardTitle></CardHeader>
          <CardContent className="h-72">{isLoading ? <div className="flex h-full items-center justify-center text-sm text-slate-500">加载中...</div> : <BarChart data={overview?.activityTrend ?? []} />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>能力维度分布</CardTitle></CardHeader>
          <CardContent className="h-72">{isLoading ? <div className="flex h-full items-center justify-center text-sm text-slate-500">加载中...</div> : <RadarChart data={overview?.abilityRadar ?? []} />}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>学生行为表</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="w-60 pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索学生姓名/学号" />
            </div>
            <select className="rounded-md border px-3 text-sm" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW')}>
              <option value="ALL">全部风险等级</option>
              <option value="HIGH">高风险</option>
              <option value="MEDIUM">中风险</option>
              <option value="LOW">低风险</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-3">学生</th><th className="py-3">测验均分</th><th className="py-3">编程时长</th><th className="py-3">讨论次数</th><th className="py-3">最近活跃</th><th className="py-3">风险评估</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarImage src={student.avatar || undefined} /><AvatarFallback>{student.studentName[0]}</AvatarFallback></Avatar>
                        <div><p className="font-medium">{student.studentName}</p><p className="text-xs text-slate-500">{student.studentId}</p></div>
                      </div>
                    </td>
                    <td className="py-3">{student.quizAvg}</td>
                    <td className="py-3">{student.codingHours} h</td>
                    <td className="py-3">{student.discussionPosts}</td>
                    <td className="py-3">{student.lastActive}</td>
                    <td className="py-3">{getRiskBadge(student.riskLevel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredStudents.length === 0 && <p className="py-8 text-center text-sm text-slate-500">暂无匹配数据</p>}
        </CardContent>
      </Card>
    </div>
  );
}
