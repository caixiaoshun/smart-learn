import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { LineChart } from '@/components/charts/LineChart';
import { RadarChart } from '@/components/charts/RadarChart';
import { PieChart } from '@/components/charts/PieChart';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Trophy,
  TrendingUp,
  ArrowUp,
  Timer,
  Brain,
  MessageSquare,
  CheckCircle,
  Code,
  Users,
  Sparkles,
  BarChart3,
  Loader2,
  Download,
  Plus,
} from 'lucide-react';

export function StudentDashboard() {
  const {
    stats,
    learningTrend,
    abilityRadar,
    recentActivities,
    modules,
    isLoading,
    fetchStats,
    fetchLearningTrend,
    fetchAbilityRadar,
    fetchRecentActivities,
    fetchModules,
    exportReport,
  } = useDashboardStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
    fetchLearningTrend();
    fetchAbilityRadar();
    fetchRecentActivities();
    fetchModules();
  }, []);

  const lineChartData = learningTrend?.labels.map((label, index) => ({
    name: label,
    value: learningTrend.data[index],
  })) || [];

  const radarChartData = abilityRadar?.labels.map((label, index) => ({
    subject: label,
    value: abilityRadar.data[index],
    fullMark: abilityRadar.fullMark,
  })) || [];

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-[#1e3a8a] text-3xl md:text-4xl font-black tracking-tight">学习全景仪表盘</h1>
          <p className="text-slate-500 text-base max-w-2xl">
            欢迎回来，{user?.name ?? '同学'}。这是您的实时学习轨迹。您的随堂测验、编程实验与讨论互动数据已更新。
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="gap-2 bg-white border-blue-200 hover:bg-blue-50 text-[#1e3a8a] font-semibold shadow-sm"
            onClick={() => exportReport()}
          >
            <Download className="w-4 h-4" />
            导出报告
          </Button>
          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/30"
            onClick={() => {
              navigate('/ai-assistant?prompt=' + encodeURIComponent('请根据我的学习数据（成绩、活跃度）生成一份详细的学习诊断报告。'));
            }}
          >
            <Sparkles className="w-4 h-4" />
            AI 诊断
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 总积分 */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)] border border-blue-100 transition-all hover:shadow-lg hover:border-blue-300/50">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-blue-100/50 blur-2xl transition-all group-hover:bg-blue-200/50" />
          <div className="flex flex-col gap-1 z-10 relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                <Trophy className="w-5 h-5" />
              </div>
              <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">总积分</p>
            </div>
            {isLoading ? (
              <div className="mt-2"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <p className="text-[#1e3a8a] text-3xl font-bold tracking-tight">
                    {stats?.totalPoints.toLocaleString() ?? '—'}
                  </p>
                  <span className="text-sm font-medium text-slate-400">/ {stats?.maxPoints.toLocaleString() ?? '—'}</span>
                </div>
                <p className="text-emerald-600 text-sm font-medium mt-1 flex items-center">
                  <TrendingUp className="w-3.5 h-3.5 mr-1" />
                  本周 +{stats?.weeklyPointsEarned ?? '—'} 分
                </p>
              </>
            )}
          </div>
        </div>

        {/* 班级排名 */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)] border border-blue-100 transition-all hover:shadow-lg hover:border-blue-300/50">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-purple-100/50 blur-2xl transition-all group-hover:bg-purple-200/50" />
          <div className="flex flex-col gap-1 z-10 relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-purple-50 text-purple-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">班级排名</p>
            </div>
            {isLoading ? (
              <div className="mt-2"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : (
              <>
                <p className="text-[#1e3a8a] text-3xl font-bold tracking-tight">{stats?.rank ?? '—'}</p>
                <p className="text-emerald-600 text-sm font-medium mt-1 flex items-center">
                  <ArrowUp className="w-3.5 h-3.5 mr-1" />
                  {stats ? ((stats.rankChange ?? 0) >= 0 ? `上升 ${stats.rankChange ?? 0} 名` : `下降 ${Math.abs(stats.rankChange ?? 0)} 名`) : '—'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* 课程进度 */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)] border border-blue-100 transition-all hover:shadow-lg hover:border-blue-300/50">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-sky-100/50 blur-2xl transition-all group-hover:bg-sky-200/50" />
          <div className="flex flex-col gap-1 z-10 relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-sky-50 text-sky-500">
                <Timer className="w-5 h-5" />
              </div>
              <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">课程进度</p>
            </div>
            {isLoading ? (
              <div className="mt-2"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : (
              <>
                <p className="text-[#1e3a8a] text-3xl font-bold tracking-tight">{stats?.courseProgress != null ? `${stats.courseProgress}%` : '—'}</p>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-sky-500 h-1.5 rounded-full shadow-sm transition-all" style={{ width: `${stats?.courseProgress ?? 0}%` }} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* AI 互动指数 */}
        <div className="group relative overflow-hidden rounded-xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)] border border-blue-100 transition-all hover:shadow-lg hover:border-blue-300/50">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-orange-100/50 blur-2xl transition-all group-hover:bg-orange-200/50" />
          <div className="flex flex-col gap-1 z-10 relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-orange-50 text-orange-500">
                <Brain className="w-5 h-5" />
              </div>
              <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">AI 互动指数</p>
            </div>
            {isLoading ? (
              <div className="mt-2"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <p className="text-[#1e3a8a] text-3xl font-bold tracking-tight">{stats?.aiInteractionScore ?? '—'}</p>
                  <span className="text-sm font-medium text-slate-400">/ 100</span>
                </div>
                <p className="text-emerald-600 text-sm font-medium mt-1 flex items-center">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {stats?.interactionLevel ?? '—'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* 学习行为趋势 */}
          <div className="rounded-xl bg-white p-6 border border-blue-100 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-[#1e3a8a] text-lg font-bold">学习行为趋势</h3>
                <p className="text-slate-500 text-sm">近7天活跃度与积分获取情况</p>
              </div>
              <span className="bg-blue-50 text-[#1e3a8a] text-sm border-none rounded-lg px-3 py-1.5 font-medium">最近 7 天</span>
            </div>
            <div className="h-[250px]">
              <LineChart data={lineChartData} />
            </div>
          </div>

          {/* 学习模块 2x2 grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 随堂测验 */}
            <div className="rounded-xl bg-white p-5 border border-blue-100 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-[#1e3a8a]">随堂测验</h4>
                </div>
                <span className="text-xs font-bold bg-green-50 text-green-600 px-2 py-1 rounded border border-green-100">
                  {modules?.quiz.level ?? '—'}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16">
                  <PieChart data={[{ name: '完成', value: modules?.quiz.avgRate ?? 0 }, { name: '未完成', value: 100 - (modules?.quiz.avgRate ?? 0) }]} colors={['#6366f1', '#e2e8f0']} innerRadius={20} outerRadius={28} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#1e3a8a]">{modules?.quiz.avgRate ?? 0}%</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <p className="text-sm text-slate-500">平均正确率</p>
                  <p className="text-sm font-medium text-[#1e3a8a] mt-1">已完成 {modules?.quiz.completed ?? 0}/{modules?.quiz.total ?? 0} 个测验</p>
                </div>
              </div>
            </div>

            {/* 编程实验 */}
            <div className="rounded-xl bg-white p-5 border border-blue-100 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-pink-50 text-pink-500">
                    <Code className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-[#1e3a8a]">编程实验</h4>
                </div>
                <span className="text-xs font-bold bg-pink-50 text-pink-500 px-2 py-1 rounded border border-pink-100">
                  {modules?.lab.status ?? '—'}
                </span>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">{modules?.lab.currentTitle ?? '暂无实验'}</span>
                  <span className="font-bold text-[#1e3a8a]">{modules?.lab.passed ?? 0}/{modules?.lab.total ?? 0} 通过</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-pink-500 h-2 rounded-full shadow-sm transition-all" style={{ width: `${modules?.lab.progress ?? 0}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-2">代码质量评分: {modules?.lab.codeQuality ?? '—'}</p>
              </div>
            </div>

            {/* 课堂表现 */}
            <div className="rounded-xl bg-white p-5 border border-blue-100 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-[#1e3a8a]">课堂表现</h4>
                </div>
                <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">
                  {modules?.classPerformance.avgScore ?? 0} 分
                </span>
              </div>
              <div className="flex gap-4 items-end h-16 pb-1 border-b border-blue-50">
                {(modules?.classPerformance.weeklyData ?? []).map((count, i) => {
                  const maxCount = Math.max(1, ...(modules?.classPerformance.weeklyData ?? [1]));
                  const pct = maxCount > 0 ? Math.max(10, Math.round((count / maxCount) * 100)) : 10;
                  const shades = ['bg-cyan-200', 'bg-cyan-400', 'bg-cyan-600', 'bg-cyan-300'];
                  return (
                    <div
                      key={i}
                      className={`flex-1 ${shades[i % shades.length]} rounded-t transition-all`}
                      style={{ height: `${pct}%` }}
                    />
                  );
                })}
              </div>
              <p className="text-sm text-slate-500">课堂问答 {modules?.classPerformance.qaCount ?? 0} 次，知识分享 {modules?.classPerformance.shareCount ?? 0} 次</p>
            </div>

            {/* 小组项目 */}
            <div className="rounded-xl bg-white p-5 border border-blue-100 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-50 text-orange-500">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-[#1e3a8a]">小组项目</h4>
                </div>
              </div>
              <div className="flex items-center -space-x-2 overflow-hidden py-1">
                {(modules?.groupProject.members ?? []).map((member, i) => (
                  <Avatar key={i} className="inline-block h-8 w-8 ring-2 ring-white">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="bg-blue-50 text-blue-700 text-xs font-bold">{member.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                ))}
                {(modules?.groupProject.extraMembers ?? 0) > 0 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white bg-blue-100 text-xs font-bold text-blue-600">
                    +{modules?.groupProject.extraMembers}
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-500">
                项目："{modules?.groupProject.projectName ?? '学习项目'}" <br />
                <span className="text-orange-500 font-medium">截止日期: {modules?.groupProject.daysLeft ?? 0}天后</span>
              </p>
            </div>
          </div>
        </div>

        {/* 右侧栏 */}
        <div className="flex flex-col gap-6">
          {/* 五维能力雷达 */}
          <div className="rounded-xl bg-white p-6 border border-blue-100 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)] flex flex-col items-center">
            <h3 className="text-[#1e3a8a] text-lg font-bold self-start mb-4">五维能力雷达</h3>
            <div className="w-64 h-64">
              <RadarChart data={radarChartData} />
            </div>
            <p className="text-center text-sm text-slate-500 mt-2">
              {abilityRadar ? (() => {
                const maxIdx = abilityRadar.data.indexOf(Math.max(...abilityRadar.data));
                return <>您的 <span className="text-blue-600 font-bold">{abilityRadar.labels[maxIdx]}</span> 表现突出。</>;
              })() : '加载中...'}
            </p>
          </div>

          {/* AI学习诊断 */}
          <div className="relative rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-[1px] shadow-lg shadow-blue-200">
            <div className="relative rounded-xl bg-white p-5 h-full flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1 rounded bg-blue-50">
                  <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                </div>
                <h3 className="text-[#1e3a8a] text-base font-bold">AI 学习诊断与建议</h3>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                {abilityRadar?.aiDiagnosis?.summary ?? '正在分析您的学习数据...'}
              </p>
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                <p className="text-indigo-800 text-xs font-medium">
                  💡 {abilityRadar?.aiDiagnosis?.suggestion ?? '正在生成建议...'}
                </p>
              </div>
              <button
                className="w-full mt-1 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold transition-colors"
                onClick={() => navigate('/student/analytics')}
              >
                查看详细分析
              </button>
            </div>
          </div>

          {/* 最近动态 */}
          <div className="rounded-xl bg-white p-6 border border-blue-100 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)] flex-1">
            <h3 className="text-[#1e3a8a] text-lg font-bold mb-4">最近动态</h3>
            <div className="flex flex-col gap-4">
              {recentActivities.map((activity, index) => {
                const dotColors = ['bg-green-500', 'bg-blue-600', 'bg-slate-400'];
                const textColors = ['text-green-600', 'text-blue-600', 'text-purple-600'];
                const dotColor = dotColors[Math.min(index, dotColors.length - 1)];
                const textColor = textColors[Math.min(index, textColors.length - 1)];
                return (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`size-2 rounded-full mt-2 ${dotColor}`} />
                      {index < recentActivities.length - 1 && <div className="w-px h-full bg-slate-100" />}
                    </div>
                    <div className="pb-2">
                      <p className="text-sm font-medium text-[#1e3a8a]">{activity.title}</p>
                      <p className="text-xs text-slate-400">{activity.description}</p>
                      <span className={`inline-block mt-1 text-xs font-bold ${textColor}`}>
                        +{activity.points} 积分
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
