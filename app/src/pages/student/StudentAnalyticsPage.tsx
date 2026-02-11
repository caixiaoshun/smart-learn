import { useEffect } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { RadarChart } from '@/components/charts/RadarChart';
import { LineChart } from '@/components/charts/LineChart';
import { Sparkles } from 'lucide-react';

export function StudentAnalyticsPage() {
  const { stats, learningTrend, abilityRadar, fetchStats, fetchLearningTrend, fetchAbilityRadar } = useDashboardStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchStats();
    fetchLearningTrend();
    fetchAbilityRadar();
  }, []);

  const lineChartData = learningTrend?.labels.map((label, index) => ({
    name: label,
    value: learningTrend.data[index],
  })) || [];

  const radarChartData = abilityRadar?.labels.map((label, index) => ({
    subject: label,
    value: abilityRadar.data[index],
    fullMark: 100,
  })) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-[#1e3a8a] text-3xl font-black tracking-tight">详细学习分析</h1>
        <p className="text-slate-500 text-base">
          {user?.name ?? '同学'}，这是您的详细学习数据分析。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-6 text-center border border-blue-100 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)]">
          <p className="text-sm text-slate-500">总积分</p>
          <p className="text-3xl font-bold text-[#1e3a8a] mt-1">{stats?.totalPoints ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-6 text-center border border-blue-100 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)]">
          <p className="text-sm text-slate-500">课程进度</p>
          <p className="text-3xl font-bold text-[#1e3a8a] mt-1">{stats?.courseProgress ?? 0}%</p>
        </div>
        <div className="rounded-xl bg-white p-6 text-center border border-blue-100 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)]">
          <p className="text-sm text-slate-500">班级排名</p>
          <p className="text-3xl font-bold text-[#1e3a8a] mt-1">{stats?.rank ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white p-6 border border-blue-100 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)]">
          <h3 className="text-[#1e3a8a] text-lg font-bold mb-4">学习行为趋势（近7天）</h3>
          <div className="h-64">
            <LineChart data={lineChartData} />
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 border border-blue-100 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)]">
          <h3 className="text-[#1e3a8a] text-lg font-bold mb-4">五维能力雷达</h3>
          <div className="h-64">
            <RadarChart data={radarChartData} />
          </div>
        </div>
      </div>

      {abilityRadar?.aiDiagnosis && (
        <div className="rounded-xl bg-white p-6 border border-blue-100 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.05),0_2px_4px_-1px_rgba(59,130,246,0.03)]">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h3 className="text-[#1e3a8a] text-lg font-bold">AI 学习诊断</h3>
          </div>
          <p className="text-slate-600">{abilityRadar.aiDiagnosis.summary}</p>
          <div className="mt-3 bg-indigo-50 rounded-lg p-3 border border-indigo-100">
            <p className="text-indigo-800 text-sm font-medium">💡 {abilityRadar.aiDiagnosis.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
}
