import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacherStore } from '@/stores/teacherStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, BarChart3, BookOpen, Clock, Library, Loader2, Sparkles, Users, ArrowRight } from 'lucide-react';

export function TeacherDashboard() {
  const { classStats, recentActivities, upcomingTasks, aiSuggestion, isLoadingDashboard, fetchClassStats, fetchRecentActivities, fetchUpcomingTasks, fetchAISuggestion } = useTeacherStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    fetchClassStats();
    fetchRecentActivities();
    fetchUpcomingTasks();
    fetchAISuggestion();
  }, []);

  const quickLinks = [
    { name: '班级管理', icon: Users, path: '/teacher/classes' },
    { name: '作业管理', icon: BookOpen, path: '/teacher/homeworks' },
    { name: '行为分析', icon: BarChart3, path: '/teacher/behavior' },
    { name: '资源中心', icon: Library, path: '/teacher/resources' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">欢迎回来，{user?.name ?? '老师'}</h1>
            <p className="mt-1 text-sky-100">今天是 {new Date().toLocaleDateString('zh-CN')}，当前待办 {upcomingTasks.length} 项。</p>
          </div>
          <Button className="gap-2 bg-white text-blue-700 hover:bg-slate-100" onClick={() => navigate('/ai-assistant?prompt=' + encodeURIComponent('我是教师，请根据当前班级作业提交率和错题分布，给出教学改进建议。'))}>
            <Sparkles className="h-4 w-4" />AI 教学助手
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '授课学生', value: classStats?.totalStudents, icon: Users },
          { label: '进行中班级', value: classStats?.totalClasses, icon: BookOpen },
          { label: '作业提交率', value: classStats?.submissionRate != null ? `${classStats.submissionRate}%` : undefined, icon: BarChart3 },
          { label: '待关注学生', value: classStats?.pendingAlerts, icon: AlertTriangle },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-lg bg-blue-50 p-2"><item.icon className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold">{isLoadingDashboard ? <Loader2 className="h-5 w-5 animate-spin" /> : (item.value ?? '—')}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>快捷入口</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {quickLinks.map((item) => (
                <button key={item.name} onClick={() => navigate(item.path)} className="rounded-xl border p-4 text-left transition hover:bg-muted/40">
                  <item.icon className="mb-3 h-5 w-5 text-blue-600" />
                  <p className="text-sm font-medium">{item.name}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>最近活动</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/analytics')}>查看全部</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="rounded-md bg-muted p-2"><Clock className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{activity.title}</p><p className="text-xs text-muted-foreground">{activity.time}</p></div>
                  <Badge variant="outline">{activity.type}</Badge>
                </div>
              ))}
              {recentActivities.length === 0 && <p className="text-sm text-muted-foreground">暂无活动记录。</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>待办任务</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {upcomingTasks.map((task) => (
                <button key={task.id} className="w-full rounded-lg border p-3 text-left hover:bg-muted/40" onClick={() => navigate('/teacher/homeworks')}>
                  <div className="flex items-center justify-between"><p className="text-sm font-medium">{task.title}</p>{task.count ? <Badge>{task.count}</Badge> : null}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{task.deadline}</p>
                </button>
              ))}
              {upcomingTasks.length === 0 && <p className="text-sm text-muted-foreground">暂无待办任务。</p>}
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/40">
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" />AI 教学建议</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700">{aiSuggestion ?? '正在分析班级数据，生成建议...'}</p>
              <Button className="mt-4 w-full justify-between" onClick={() => navigate('/ai-assistant?prompt=' + encodeURIComponent('我是教师，请根据当前班级作业提交率和错题分布，给出教学改进建议。'))}>查看详细建议<ArrowRight className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
